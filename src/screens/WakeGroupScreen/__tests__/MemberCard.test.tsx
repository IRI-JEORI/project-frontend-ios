import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { WakeGroupMember } from '../../../api/types';
import {
  canOpenWakeConfirmation,
  cooldownRemainingMinutes,
  cooldownRemainingSeconds,
  dndActionLabel,
  memberCardSecondary,
  memberActionLabel,
  memberCardStatus,
} from '../memberCardState';
import MemberCard from '../components/MemberCard';

const member = (overrides: Partial<WakeGroupMember>): WakeGroupMember => ({
  user_id: 99,
  nickname: '아무 사용자',
  avatar_url: null,
  is_me: false,
  target_wake_time: '09:00',
  next_target_at: null,
  remaining_to_target: null,
  state: 'NORMAL',
  actual_wake_time: null,
  proof_image_url: null,
  proof_expires_at: null,
  can_wake: true,
  block_reason: null,
  wake_available_at: null,
  ...overrides,
});

const renderCard = async (
  status: 'pending' | 'done' | 'needsHelp' | 'dnd',
  actionLabel = '깨우기',
  onPress = jest.fn(),
) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = ReactTestRenderer.create(
      <MemberCard
        name="임의 멤버"
        status={status}
        primaryValue="09:00"
        primaryLabel="기상 목표"
        secondaryValue="--"
        secondaryLabel="NEEDS_HELP"
        actionLabel={actionLabel}
        onPressAction={onPress}
      />,
    );
  });
  return renderer;
};

describe('WakeGroup MemberCard states', () => {
  it('maps NORMAL to pending and AWAKE to done', () => {
    expect(memberCardStatus(member({ state: 'NORMAL' }))).toBe('pending');
    expect(memberCardStatus(member({ state: 'AWAKE' }))).toBe('done');
  });

  it('maps only another DND member to the black class-in-progress card', async () => {
    const otherDnd = member({ can_wake: false, block_reason: 'DND' });
    expect(memberCardStatus(otherDnd)).toBe('dnd');
    expect(memberCardStatus({ ...otherDnd, is_me: true })).toBe('pending');

    const renderer = await renderCard('dnd', '22:00 이후 깨우기 가능');
    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    const pen = renderer.root
      .findAllByType(Image)
      .find(node => node.props.accessibilityLabel === '수업 중');
    const blackCard = renderer.root
      .findAllByType(View)
      .find(node =>
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style: { backgroundColor?: string }) => style?.backgroundColor === '#202224',
        ),
      );

    expect(labels).toContain('방해하지 말아주세요');
    expect(pen).toBeDefined();
    expect(blackCard).toBeDefined();
  });

  it('uses the API wake availability time and a safe DND fallback', () => {
    expect(dndActionLabel('2026-08-20T22:00:00+09:00')).toBe(
      '22:00 이후 깨우기 가능',
    );
    expect(dndActionLabel(null)).toBe('방해금지');
    expect(dndActionLabel('invalid')).toBe('방해금지');
  });

  it('shows the remaining cooldown next to an awake time', () => {
    const awakeMember = member({
      state: 'AWAKE',
      actual_wake_time: '09:00',
      can_wake: false,
      block_reason: 'COOLDOWN',
      wake_available_at: '2026-08-20T09:30:00+09:00',
    });
    const nowMs = new Date('2026-08-20T09:10:01+09:00').getTime();

    expect(
      cooldownRemainingMinutes(awakeMember.wake_available_at, nowMs),
    ).toBe(20);
    expect(
      cooldownRemainingSeconds(awakeMember.wake_available_at, nowMs),
    ).toBe(1199);
    expect(memberCardSecondary(awakeMember, nowMs)).toEqual({
      value: '19:59',
      label: '쿨다운',
    });
  });

  it('moves the cooldown timer into the action area without a waiting label', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(() => {
      renderer = ReactTestRenderer.create(
        <MemberCard
          name="임의 멤버"
          status="done"
          primaryValue="09:00"
          primaryLabel="기상 시간"
          secondaryValue="19:59"
          secondaryLabel="쿨다운"
          actionLabel="대기 중"
        />,
      );
    });

    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    expect(labels).toContain('19:59');
    expect(labels).toContain('쿨다운');
    expect(labels).not.toContain('대기 중');
    expect(renderer.root.findByProps({ accessibilityRole: 'timer' })).toBeDefined();
  });

  it('disables the DND action without invoking wake', async () => {
    const onPress = jest.fn();
    const renderer = await renderCard('dnd', '방해금지', onPress);
    const button = renderer.root
      .findAllByType(TouchableOpacity)
      .find(node => node.findAllByType(Text).some(text => text.props.children === '방해금지'));

    expect(button?.props.disabled).toBe(true);
    expect(button?.props.onPress).toBeUndefined();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps AWAKE and NEEDS_HELP above DND in card priority', () => {
    expect(memberCardStatus(member({ state: 'AWAKE', block_reason: 'DND' }))).toBe('done');
    expect(memberCardStatus(member({ state: 'NEEDS_HELP', block_reason: 'DND' }))).toBe(
      'needsHelp',
    );
  });

  it('opens confirmation only for a wakeable other member', () => {
    expect(canOpenWakeConfirmation(member({}))).toBe(true);
    expect(canOpenWakeConfirmation(member({ state: 'NEEDS_HELP' }))).toBe(true);
    expect(canOpenWakeConfirmation(member({ is_me: true }))).toBe(false);
    expect(canOpenWakeConfirmation(member({ can_wake: false }))).toBe(false);
    expect(
      canOpenWakeConfirmation(member({ can_wake: false, block_reason: 'DND' })),
    ).toBe(false);
    expect(canOpenWakeConfirmation(member({ state: 'AWAKE' }))).toBe(false);
  });

  it('renders a generic NEEDS_HELP card with the red background, fire, and message', async () => {
    const renderer = await renderCard('needsHelp');
    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    const fire = renderer.root
      .findAllByType(Image)
      .find(node => node.props.accessibilityLabel === '도움이 필요해요');
    const redCard = renderer.root
      .findAllByType(View)
      .find(node =>
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style: { backgroundColor?: string }) =>
            style?.backgroundColor === '#FF4B4B',
        ),
      );

    expect(
      memberCardStatus(member({ state: 'NEEDS_HELP', nickname: '누구든지' })),
    ).toBe('needsHelp');
    expect(labels).toContain('도움이 필요해요!');
    expect(fire).toBeDefined();
    expect(redCard).toBeDefined();
  });

  it('keeps actions based on can_wake and block_reason', () => {
    expect(
      memberActionLabel(member({ state: 'NEEDS_HELP', can_wake: true })),
    ).toBe('깨우기');
    expect(
      memberActionLabel(
        member({ state: 'NEEDS_HELP', can_wake: false, block_reason: 'DND' }),
      ),
    ).toBe('방해금지');
    expect(
      memberActionLabel(
        member({
          state: 'NEEDS_HELP',
          can_wake: false,
          block_reason: 'COOLDOWN',
        }),
      ),
    ).toBe('대기 중');
  });

  it('keeps the wake button active for NEEDS_HELP', async () => {
    const onPress = jest.fn();
    const renderer = await renderCard('needsHelp', '깨우기', onPress);
    const button = renderer.root
      .findAllByType(TouchableOpacity)
      .find(node =>
        node
          .findAllByType(Text)
          .some(text => text.props.children === '깨우기'),
      );
    act(() => button?.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
