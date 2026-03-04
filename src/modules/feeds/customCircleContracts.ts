import type { CustomCircleMemberPayload } from '@/lib/crypto';

export enum CircleOperationErrorCode {
  NONE = 'NONE',
  DUPLICATE = 'DUPLICATE',
  ELIGIBILITY = 'ELIGIBILITY',
  OWNERSHIP = 'OWNERSHIP',
  NAME = 'NAME',
  LIMIT = 'LIMIT',
  REJECTED = 'REJECTED',
  UNKNOWN = 'UNKNOWN',
}

export interface CreateCustomCircleInput {
  ownerPublicAddress: string;
  circleName: string;
  signingPrivateKeyHex: string;
  feedId?: string;
}

export interface AddMembersToCustomCircleInput {
  feedId: string;
  ownerPublicAddress: string;
  members: CustomCircleMemberPayload[];
  signingPrivateKeyHex: string;
}

export interface CircleOperationResult<TStatus = number> {
  success: boolean;
  message: string;
  errorCode: CircleOperationErrorCode;
  retryable: boolean;
  status: TStatus;
  feedId?: string;
}

export interface CircleValidationFailure {
  message: string;
  errorCode: CircleOperationErrorCode;
}

export function mapCircleErrorCodeFromMessage(
  message: string | undefined,
  isRejectedStatus: boolean
): CircleOperationErrorCode {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('duplicate') || normalized.includes('already exists')) {
    return CircleOperationErrorCode.DUPLICATE;
  }
  if (normalized.includes('follow') || normalized.includes('eligible') || normalized.includes('chat feed')) {
    return CircleOperationErrorCode.ELIGIBILITY;
  }
  if (normalized.includes('owner') || normalized.includes('unauthorized')) {
    return CircleOperationErrorCode.OWNERSHIP;
  }
  if (normalized.includes('name') || normalized.includes('circle')) {
    return CircleOperationErrorCode.NAME;
  }
  if (normalized.includes('limit') || normalized.includes('max') || normalized.includes('between 1 and 100')) {
    return CircleOperationErrorCode.LIMIT;
  }
  if (isRejectedStatus) {
    return CircleOperationErrorCode.REJECTED;
  }
  return CircleOperationErrorCode.UNKNOWN;
}

export function validateCustomCircleNameInput(circleName: string): CircleValidationFailure | null {
  const trimmed = circleName.trim();
  if (trimmed.length < 3 || trimmed.length > 40 || !/^[A-Za-z0-9 _-]+$/.test(trimmed)) {
    return {
      message: 'Circle name must be 3-40 chars and use letters, numbers, spaces, hyphen, underscore',
      errorCode: CircleOperationErrorCode.NAME,
    };
  }

  return null;
}

export function validateCustomCircleMembersInput(
  members: CustomCircleMemberPayload[]
): CircleValidationFailure | null {
  if (members.length === 0 || members.length > 100) {
    return {
      message: 'Members must contain between 1 and 100 users',
      errorCode: CircleOperationErrorCode.LIMIT,
    };
  }

  const addresses = members.map((member) => member.PublicAddress.trim());
  if (addresses.some((address) => address.length === 0)) {
    return {
      message: 'All members must include a valid address',
      errorCode: CircleOperationErrorCode.ELIGIBILITY,
    };
  }

  const uniqueCount = new Set(addresses).size;
  if (uniqueCount !== addresses.length) {
    return {
      message: 'Duplicate members are not allowed in the same request',
      errorCode: CircleOperationErrorCode.DUPLICATE,
    };
  }

  return null;
}
