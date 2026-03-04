import { describe, expect, it } from 'vitest';
import {
  CircleOperationErrorCode,
  mapCircleErrorCodeFromMessage,
  validateCustomCircleMembersInput,
  validateCustomCircleNameInput,
} from './customCircleContracts';

describe('customCircleContracts', () => {
  it('maps deterministic error codes from known backend messages', () => {
    expect(mapCircleErrorCodeFromMessage('already exists', false)).toBe(CircleOperationErrorCode.DUPLICATE);
    expect(mapCircleErrorCodeFromMessage('not eligible because no chat feed', false)).toBe(CircleOperationErrorCode.ELIGIBILITY);
    expect(mapCircleErrorCodeFromMessage('only owner can execute', false)).toBe(CircleOperationErrorCode.OWNERSHIP);
    expect(mapCircleErrorCodeFromMessage('invalid circle name', false)).toBe(CircleOperationErrorCode.NAME);
    expect(mapCircleErrorCodeFromMessage('max limit reached', false)).toBe(CircleOperationErrorCode.LIMIT);
  });

  it('falls back to REJECTED when status is rejected and message is unknown', () => {
    expect(mapCircleErrorCodeFromMessage('unexpected backend text', true)).toBe(CircleOperationErrorCode.REJECTED);
  });

  it('validates circle names with FEAT-092 constraints', () => {
    expect(validateCustomCircleNameInput('ab')?.errorCode).toBe(CircleOperationErrorCode.NAME);
    expect(validateCustomCircleNameInput('Valid Circle_01')).toBeNull();
  });

  it('validates add-members payload constraints', () => {
    expect(validateCustomCircleMembersInput([])?.errorCode).toBe(CircleOperationErrorCode.LIMIT);
    expect(
      validateCustomCircleMembersInput([
        { PublicAddress: 'A', PublicEncryptAddress: 'encA' },
        { PublicAddress: 'A', PublicEncryptAddress: 'encA2' },
      ])?.errorCode
    ).toBe(CircleOperationErrorCode.DUPLICATE);
    expect(
      validateCustomCircleMembersInput([{ PublicAddress: 'B', PublicEncryptAddress: 'encB' }])
    ).toBeNull();
  });
});
