import { getSlackContext } from './verification';

describe('verification', () => {
  describe('getSlackContext', () => {
    it('should extract teamId and enterpriseId from top-level fields', () => {
      const body = {
        team_id: 'T123',
        enterprise_id: 'E123',
      };
      const context = getSlackContext(body);
      expect(context.teamId).toBe('T123');
      expect(context.enterpriseId).toBe('E123');
    });

    it('should extract teamId and enterpriseId from nested objects', () => {
      const body = {
        team: { id: 'T123' },
        enterprise: { id: 'E123' },
      };
      const context = getSlackContext(body);
      expect(context.teamId).toBe('T123');
      expect(context.enterpriseId).toBe('E123');
    });

    it('should extract teamId and enterpriseId from authorizations array', () => {
      const body = {
        authorizations: [
          { team_id: 'T123', enterprise_id: 'E123' },
        ],
      };
      const context = getSlackContext(body);
      expect(context.teamId).toBe('T123');
      expect(context.enterpriseId).toBe('E123');
    });

    it('should return undefined if no context is found', () => {
      const body = {
        something_else: 'value',
      };
      const context = getSlackContext(body);
      expect(context.teamId).toBeUndefined();
      expect(context.enterpriseId).toBeUndefined();
    });

    it('should handle non-object bodies safely', () => {
      expect(getSlackContext(null)).toEqual({ teamId: undefined, enterpriseId: undefined });
      expect(getSlackContext('string')).toEqual({ teamId: undefined, enterpriseId: undefined });
      expect(getSlackContext(123)).toEqual({ teamId: undefined, enterpriseId: undefined });
    });

    it('should prioritize top-level fields over nested ones', () => {
      const body = {
        team_id: 'T_TOP',
        team: { id: 'T_NESTED' },
      };
      const context = getSlackContext(body);
      expect(context.teamId).toBe('T_TOP');
    });
  });
});
