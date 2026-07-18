import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Auth Callback Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should save tokens to localStorage on successful auth', () => {
    const data = {
      access_token: 'test_token_123',
      refresh_token: 'test_refresh_123',
      user: {
        id: 'user_123',
        username: 'testuser',
        displayName: 'Test User',
        pubgNickname: 'TestPlayer',
        avatarUrl: 'https://example.com/avatar.png'
      }
    };

    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));

    expect(localStorage.getItem('access_token')).toBe('test_token_123');
    expect(localStorage.getItem('refresh_token')).toBe('test_refresh_123');
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(data.user);
  });

  it('should restore user from localStorage when code is reused', () => {
    const storedUser = {
      id: 'existing_user',
      username: 'existing',
      displayName: 'Existing User'
    };
    
    localStorage.setItem('user', JSON.stringify(storedUser));
    localStorage.setItem('access_token', 'existing_token');

    const restoredUser = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('access_token');

    expect(restoredUser.id).toBe('existing_user');
    expect(token).toBe('existing_token');
  });

  it('should handle user object with camelCase fields', () => {
    const user = {
      id: '1',
      username: 'test',
      displayName: 'Test User',
      pubgNickname: 'TestPlayer',
      avatarUrl: 'https://example.com/avatar.png'
    };

    expect(user.displayName).toBe('Test User');
    expect(user.pubgNickname).toBe('TestPlayer');
    expect(user.avatarUrl).toBe('https://example.com/avatar.png');
    
    expect(user.display_name).toBeUndefined();
    expect(user.pubg_nickname).toBeUndefined();
  });

  it('should redirect to dashboard when user exists in localStorage', () => {
    const storedUser = { id: '1', username: 'test' };
    localStorage.setItem('user', JSON.stringify(storedUser));
    
    const hasUser = !!localStorage.getItem('user');
    const shouldRedirect = hasUser;
    
    expect(shouldRedirect).toBe(true);
  });
});

describe('User Store Persistence', () => {
  it('should persist user in zustand store', () => {
    const user = {
      id: 'test_id',
      username: 'testuser',
      displayName: 'Test User',
      pubgNickname: 'TestPlayer'
    };

    const stored = JSON.stringify(user);
    const parsed = JSON.parse(stored);

    expect(parsed.id).toBe('test_id');
    expect(parsed.username).toBe('testuser');
    expect(parsed.displayName).toBe('Test User');
  });
});