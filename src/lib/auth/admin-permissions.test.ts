import { describe, expect, it } from 'vitest';
import {
  canCreateAdminRole,
  canDeleteAdmin,
  canListAdmins,
  canManageSellers,
} from './admin-permissions';

describe('canCreateAdminRole', () => {
  it('owner her iki rolü de oluşturabilir', () => {
    expect(canCreateAdminRole('owner', 'owner')).toBe(true);
    expect(canCreateAdminRole('owner', 'helper')).toBe(true);
  });

  it('helper sadece helper oluşturabilir', () => {
    expect(canCreateAdminRole('helper', 'helper')).toBe(true);
    expect(canCreateAdminRole('helper', 'owner')).toBe(false);
  });
});

describe('canDeleteAdmin', () => {
  it('sadece owner silebilir', () => {
    expect(canDeleteAdmin('owner')).toBe(true);
    expect(canDeleteAdmin('helper')).toBe(false);
  });
});

describe('canManageSellers', () => {
  it('owner ve helper satıcı yönetebilir', () => {
    expect(canManageSellers('owner')).toBe(true);
    expect(canManageSellers('helper')).toBe(true);
  });
});

describe('canListAdmins', () => {
  it('owner ve helper admin listesini görebilir', () => {
    expect(canListAdmins('owner')).toBe(true);
    expect(canListAdmins('helper')).toBe(true);
  });
});
