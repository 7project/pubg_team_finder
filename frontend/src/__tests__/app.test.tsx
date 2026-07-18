import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../stores/app-store';

describe('AppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: null,
      isDarkMode: true,
      language: 'ru',
      suggestedPlayers: [],
      groupPlayers: [],
      groups: [],
      activeMatch: null,
      invitedPlayers: [],
    });
  });

  it('should toggle dark mode', () => {
    const { toggleDarkMode, isDarkMode } = useAppStore.getState();
    expect(isDarkMode).toBe(true);
    toggleDarkMode();
    expect(useAppStore.getState().isDarkMode).toBe(false);
  });

  it('should set language', () => {
    const { setLanguage, language } = useAppStore.getState();
    expect(language).toBe('ru');
    setLanguage('en');
    expect(useAppStore.getState().language).toBe('en');
  });

  it('should set user', () => {
    const { setUser, user } = useAppStore.getState();
    expect(user).toBeNull();
    
    const testUser = {
      id: '1',
      username: 'TestUser',
      displayName: 'Test User',
      pubgNickname: 'TestPlayer',
      pubgRank: 'Diamond',
      avatarUrl: 'https://example.com/avatar.png',
      tiktokLink: 'https://tiktok.com/@test',
      youtubeShortsLink: '',
      privacySetting: 'PUBLIC' as const,
    };
    
    setUser(testUser);
    expect(useAppStore.getState().user).toEqual(testUser);
  });

  it('should invite player', () => {
    const { invitePlayer, invitedPlayers } = useAppStore.getState();
    expect(invitedPlayers).toHaveLength(0);
    
    invitePlayer('player-1');
    expect(useAppStore.getState().invitedPlayers).toContain('player-1');
    
    invitePlayer('player-2');
    expect(useAppStore.getState().invitedPlayers).toHaveLength(2);
  });

  it('should remove invited player', () => {
    useAppStore.setState({ invitedPlayers: ['player-1', 'player-2'] });
    
    const { removeInvitedPlayer, invitedPlayers } = useAppStore.getState();
    expect(invitedPlayers).toHaveLength(2);
    
    removeInvitedPlayer('player-1');
    expect(useAppStore.getState().invitedPlayers).toEqual(['player-2']);
  });

  it('should clear invites', () => {
    useAppStore.setState({ invitedPlayers: ['player-1', 'player-2'] });
    
    const { clearInvites, invitedPlayers } = useAppStore.getState();
    expect(invitedPlayers).toHaveLength(2);
    
    clearInvites();
    expect(useAppStore.getState().invitedPlayers).toHaveLength(0);
  });

  it('should logout', () => {
    useAppStore.setState({
      user: { id: '1', username: 'Test', privacySetting: 'PUBLIC' as const },
      suggestedPlayers: [{ id: '1', username: 'Player', rating: 5, isFromGroup: false }],
      groups: [{ id: '1', name: 'Group', memberCount: 1, isPublic: true, ownerId: '1', members: [] }],
      invitedPlayers: ['player-1'],
    });
    
    const { logout } = useAppStore.getState();
    logout();
    
    const state = useAppStore.getState();
    expect(state.user).toBeNull();
    expect(state.suggestedPlayers).toHaveLength(0);
    expect(state.groups).toHaveLength(0);
    expect(state.invitedPlayers).toHaveLength(0);
  });
});

describe('Toggle Component', () => {
  it('should render toggle with label', () => {
    const Toggle = require('../components/ui').Toggle;
    const { container } = render(
      <Toggle checked={true} onChange={() => {}} label="Test Label" />
    );
    
    expect(container.textContent).toContain('Test Label');
  });
});

describe('Rating Form', () => {
  it('should submit rating', async () => {
    const RatingForm = require('../components/features/rating-form').RatingForm;
    
    const mockOnSubmit = vi.fn();
    
    render(
      <RatingForm
        userId="1"
        username="TestPlayer"
        onSubmit={mockOnSubmit}
        onSkip={() => {}}
      />
    );
    
    const submitButton = screen.getByText('Отправить');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Оценка отправлена!')).toBeInTheDocument();
    });
  });
});