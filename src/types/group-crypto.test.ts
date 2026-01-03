/**
 * Unit tests for group crypto types and type guards
 */

import { describe, it, expect } from 'vitest';
import {
  isGroupKeyGeneration,
  isGroupKeyState,
  isGroupCryptoResult,
  isGroupParticipantEncryptedKey,
  isNewGroupFeedData,
  isGroupMessageDecryptionContext,
  type GroupKeyGeneration,
  type GroupKeyState,
  type GroupCryptoResult,
  type GroupParticipantEncryptedKey,
  type NewGroupFeedData,
  type GroupMessageDecryptionContext,
} from './group-crypto';

describe('isGroupKeyGeneration', () => {
  const validKeyGen: GroupKeyGeneration = {
    keyGeneration: 0,
    validFromBlock: 1000,
    aesKey: 'base64encodedkey123==',
  };

  it('should return true for valid GroupKeyGeneration', () => {
    expect(isGroupKeyGeneration(validKeyGen)).toBe(true);
  });

  it('should return true with optional validToBlock', () => {
    const withValidTo = { ...validKeyGen, validToBlock: 2000 };
    expect(isGroupKeyGeneration(withValidTo)).toBe(true);
  });

  it('should return true for keyGeneration 0', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, keyGeneration: 0 })).toBe(true);
  });

  it('should return true for large keyGeneration numbers', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, keyGeneration: 999 })).toBe(true);
  });

  it('should return false for negative keyGeneration', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, keyGeneration: -1 })).toBe(false);
  });

  it('should return false for non-integer keyGeneration', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, keyGeneration: 1.5 })).toBe(false);
  });

  it('should return false for negative validFromBlock', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, validFromBlock: -1 })).toBe(false);
  });

  it('should return false for non-integer validFromBlock', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, validFromBlock: 100.5 })).toBe(false);
  });

  it('should return false for negative validToBlock', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, validToBlock: -1 })).toBe(false);
  });

  it('should return false for non-integer validToBlock', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, validToBlock: 200.5 })).toBe(false);
  });

  it('should return false for empty aesKey', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, aesKey: '' })).toBe(false);
  });

  it('should return false for missing keyGeneration', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyGeneration, ...withoutKeyGen } = validKeyGen;
    expect(isGroupKeyGeneration(withoutKeyGen)).toBe(false);
  });

  it('should return false for missing validFromBlock', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { validFromBlock, ...withoutBlock } = validKeyGen;
    expect(isGroupKeyGeneration(withoutBlock)).toBe(false);
  });

  it('should return false for missing aesKey', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { aesKey, ...withoutKey } = validKeyGen;
    expect(isGroupKeyGeneration(withoutKey)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isGroupKeyGeneration(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGroupKeyGeneration(undefined)).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isGroupKeyGeneration('string')).toBe(false);
    expect(isGroupKeyGeneration(123)).toBe(false);
    expect(isGroupKeyGeneration([])).toBe(false);
  });

  it('should return false for wrong field types', () => {
    expect(isGroupKeyGeneration({ ...validKeyGen, keyGeneration: '0' })).toBe(false);
    expect(isGroupKeyGeneration({ ...validKeyGen, validFromBlock: '1000' })).toBe(false);
    expect(isGroupKeyGeneration({ ...validKeyGen, aesKey: 123 })).toBe(false);
  });
});

describe('isGroupKeyState', () => {
  const validKeyGen: GroupKeyGeneration = {
    keyGeneration: 0,
    validFromBlock: 1000,
    aesKey: 'base64encodedkey123==',
  };

  const validKeyState: GroupKeyState = {
    currentKeyGeneration: 0,
    keyGenerations: [validKeyGen],
    missingKeyGenerations: [],
  };

  it('should return true for valid GroupKeyState', () => {
    expect(isGroupKeyState(validKeyState)).toBe(true);
  });

  it('should return true with empty keyGenerations', () => {
    const emptyKeys = { ...validKeyState, keyGenerations: [] };
    expect(isGroupKeyState(emptyKeys)).toBe(true);
  });

  it('should return true with multiple keyGenerations', () => {
    const multipleKeys = {
      ...validKeyState,
      currentKeyGeneration: 2,
      keyGenerations: [
        { keyGeneration: 0, validFromBlock: 1000, validToBlock: 2000, aesKey: 'key0==' },
        { keyGeneration: 1, validFromBlock: 2000, validToBlock: 3000, aesKey: 'key1==' },
        { keyGeneration: 2, validFromBlock: 3000, aesKey: 'key2==' },
      ],
    };
    expect(isGroupKeyState(multipleKeys)).toBe(true);
  });

  it('should return true with missingKeyGenerations', () => {
    const withMissing = {
      ...validKeyState,
      currentKeyGeneration: 4,
      missingKeyGenerations: [2, 3],
    };
    expect(isGroupKeyState(withMissing)).toBe(true);
  });

  it('should return false for negative currentKeyGeneration', () => {
    expect(isGroupKeyState({ ...validKeyState, currentKeyGeneration: -1 })).toBe(false);
  });

  it('should return false for non-integer currentKeyGeneration', () => {
    expect(isGroupKeyState({ ...validKeyState, currentKeyGeneration: 1.5 })).toBe(false);
  });

  it('should return false for invalid keyGeneration in array', () => {
    const invalidKeyGen = {
      ...validKeyState,
      keyGenerations: [{ keyGeneration: -1, validFromBlock: 1000, aesKey: 'key==' }],
    };
    expect(isGroupKeyState(invalidKeyGen)).toBe(false);
  });

  it('should return false for invalid missingKeyGenerations values', () => {
    expect(isGroupKeyState({ ...validKeyState, missingKeyGenerations: [-1] })).toBe(false);
    expect(isGroupKeyState({ ...validKeyState, missingKeyGenerations: [1.5] })).toBe(false);
    expect(isGroupKeyState({ ...validKeyState, missingKeyGenerations: ['1'] })).toBe(false);
  });

  it('should return false for non-array keyGenerations', () => {
    expect(isGroupKeyState({ ...validKeyState, keyGenerations: {} })).toBe(false);
  });

  it('should return false for non-array missingKeyGenerations', () => {
    expect(isGroupKeyState({ ...validKeyState, missingKeyGenerations: {} })).toBe(false);
  });

  it('should return false for missing currentKeyGeneration', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { currentKeyGeneration, ...withoutCurrent } = validKeyState;
    expect(isGroupKeyState(withoutCurrent)).toBe(false);
  });

  it('should return false for missing keyGenerations', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyGenerations, ...withoutKeys } = validKeyState;
    expect(isGroupKeyState(withoutKeys)).toBe(false);
  });

  it('should return false for missing missingKeyGenerations', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { missingKeyGenerations, ...withoutMissing } = validKeyState;
    expect(isGroupKeyState(withoutMissing)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isGroupKeyState(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGroupKeyState(undefined)).toBe(false);
  });
});

describe('isGroupCryptoResult', () => {
  const successResult: GroupCryptoResult<string> = {
    success: true,
    data: 'some data',
  };

  const failureResult: GroupCryptoResult = {
    success: false,
    error: 'Something went wrong',
  };

  it('should return true for success result with data', () => {
    expect(isGroupCryptoResult(successResult)).toBe(true);
  });

  it('should return true for failure result with error', () => {
    expect(isGroupCryptoResult(failureResult)).toBe(true);
  });

  it('should return true for success result without data', () => {
    const noData: GroupCryptoResult = { success: true };
    expect(isGroupCryptoResult(noData)).toBe(true);
  });

  it('should return true for failure result without error', () => {
    const noError: GroupCryptoResult = { success: false };
    expect(isGroupCryptoResult(noError)).toBe(true);
  });

  it('should return true with data validator that passes', () => {
    const isString = (val: unknown): val is string => typeof val === 'string';
    expect(isGroupCryptoResult(successResult, isString)).toBe(true);
  });

  it('should return false with data validator that fails', () => {
    const isNumber = (val: unknown): val is number => typeof val === 'number';
    expect(isGroupCryptoResult(successResult, isNumber)).toBe(false);
  });

  it('should return false for missing success field', () => {
    expect(isGroupCryptoResult({ data: 'test' })).toBe(false);
  });

  it('should return false for wrong success type', () => {
    expect(isGroupCryptoResult({ success: 'true' })).toBe(false);
  });

  it('should return false for wrong error type', () => {
    expect(isGroupCryptoResult({ success: false, error: 123 })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isGroupCryptoResult(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGroupCryptoResult(undefined)).toBe(false);
  });
});

describe('isGroupParticipantEncryptedKey', () => {
  const validKey: GroupParticipantEncryptedKey = {
    participantPublicAddress: 'addr123',
    encryptedFeedKey: 'encryptedkey123==',
  };

  it('should return true for valid GroupParticipantEncryptedKey', () => {
    expect(isGroupParticipantEncryptedKey(validKey)).toBe(true);
  });

  it('should return false for empty participantPublicAddress', () => {
    expect(isGroupParticipantEncryptedKey({ ...validKey, participantPublicAddress: '' })).toBe(
      false
    );
  });

  it('should return false for empty encryptedFeedKey', () => {
    expect(isGroupParticipantEncryptedKey({ ...validKey, encryptedFeedKey: '' })).toBe(false);
  });

  it('should return false for missing participantPublicAddress', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { participantPublicAddress, ...withoutAddr } = validKey;
    expect(isGroupParticipantEncryptedKey(withoutAddr)).toBe(false);
  });

  it('should return false for missing encryptedFeedKey', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedFeedKey, ...withoutKey } = validKey;
    expect(isGroupParticipantEncryptedKey(withoutKey)).toBe(false);
  });

  it('should return false for wrong field types', () => {
    expect(isGroupParticipantEncryptedKey({ ...validKey, participantPublicAddress: 123 })).toBe(
      false
    );
    expect(isGroupParticipantEncryptedKey({ ...validKey, encryptedFeedKey: null })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isGroupParticipantEncryptedKey(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGroupParticipantEncryptedKey(undefined)).toBe(false);
  });
});

describe('isNewGroupFeedData', () => {
  const validParticipantKey: GroupParticipantEncryptedKey = {
    participantPublicAddress: 'addr123',
    encryptedFeedKey: 'encryptedkey123==',
  };

  const validData: NewGroupFeedData = {
    feedId: 'feed-uuid-123',
    name: 'Test Group',
    isPublic: false,
    keyGeneration: 0,
    participantKeys: [validParticipantKey],
  };

  it('should return true for valid NewGroupFeedData', () => {
    expect(isNewGroupFeedData(validData)).toBe(true);
  });

  it('should return true with optional description', () => {
    const withDesc = { ...validData, description: 'A test group' };
    expect(isNewGroupFeedData(withDesc)).toBe(true);
  });

  it('should return true for public group', () => {
    const publicGroup = { ...validData, isPublic: true };
    expect(isNewGroupFeedData(publicGroup)).toBe(true);
  });

  it('should return true with multiple participant keys', () => {
    const multipleKeys = {
      ...validData,
      participantKeys: [
        validParticipantKey,
        { participantPublicAddress: 'addr456', encryptedFeedKey: 'key456==' },
      ],
    };
    expect(isNewGroupFeedData(multipleKeys)).toBe(true);
  });

  it('should return true with empty participantKeys', () => {
    const noKeys = { ...validData, participantKeys: [] };
    expect(isNewGroupFeedData(noKeys)).toBe(true);
  });

  it('should return true for keyGeneration > 0', () => {
    const rotatedKey = { ...validData, keyGeneration: 5 };
    expect(isNewGroupFeedData(rotatedKey)).toBe(true);
  });

  it('should return false for empty feedId', () => {
    expect(isNewGroupFeedData({ ...validData, feedId: '' })).toBe(false);
  });

  it('should return false for empty name', () => {
    expect(isNewGroupFeedData({ ...validData, name: '' })).toBe(false);
  });

  it('should return false for name over 100 characters', () => {
    expect(isNewGroupFeedData({ ...validData, name: 'a'.repeat(101) })).toBe(false);
  });

  it('should return true for 100 character name', () => {
    expect(isNewGroupFeedData({ ...validData, name: 'a'.repeat(100) })).toBe(true);
  });

  it('should return false for description over 500 characters', () => {
    expect(isNewGroupFeedData({ ...validData, description: 'a'.repeat(501) })).toBe(false);
  });

  it('should return true for 500 character description', () => {
    expect(isNewGroupFeedData({ ...validData, description: 'a'.repeat(500) })).toBe(true);
  });

  it('should return false for negative keyGeneration', () => {
    expect(isNewGroupFeedData({ ...validData, keyGeneration: -1 })).toBe(false);
  });

  it('should return false for non-integer keyGeneration', () => {
    expect(isNewGroupFeedData({ ...validData, keyGeneration: 1.5 })).toBe(false);
  });

  it('should return false for invalid participant key in array', () => {
    const invalidKey = {
      ...validData,
      participantKeys: [{ participantPublicAddress: '', encryptedFeedKey: 'key==' }],
    };
    expect(isNewGroupFeedData(invalidKey)).toBe(false);
  });

  it('should return false for missing required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { feedId, ...withoutFeedId } = validData;
    expect(isNewGroupFeedData(withoutFeedId)).toBe(false);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name, ...withoutName } = validData;
    expect(isNewGroupFeedData(withoutName)).toBe(false);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPublic, ...withoutPublic } = validData;
    expect(isNewGroupFeedData(withoutPublic)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isNewGroupFeedData(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isNewGroupFeedData(undefined)).toBe(false);
  });
});

describe('isGroupMessageDecryptionContext', () => {
  const validContext: GroupMessageDecryptionContext = {
    feedId: 'feed-uuid-123',
    keyGeneration: 0,
    encryptedContent: 'base64encryptedcontent==',
  };

  it('should return true for valid GroupMessageDecryptionContext', () => {
    expect(isGroupMessageDecryptionContext(validContext)).toBe(true);
  });

  it('should return true for keyGeneration > 0', () => {
    const rotatedKey = { ...validContext, keyGeneration: 5 };
    expect(isGroupMessageDecryptionContext(rotatedKey)).toBe(true);
  });

  it('should return false for empty feedId', () => {
    expect(isGroupMessageDecryptionContext({ ...validContext, feedId: '' })).toBe(false);
  });

  it('should return false for empty encryptedContent', () => {
    expect(isGroupMessageDecryptionContext({ ...validContext, encryptedContent: '' })).toBe(false);
  });

  it('should return false for negative keyGeneration', () => {
    expect(isGroupMessageDecryptionContext({ ...validContext, keyGeneration: -1 })).toBe(false);
  });

  it('should return false for non-integer keyGeneration', () => {
    expect(isGroupMessageDecryptionContext({ ...validContext, keyGeneration: 1.5 })).toBe(false);
  });

  it('should return false for missing feedId', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { feedId, ...withoutFeedId } = validContext;
    expect(isGroupMessageDecryptionContext(withoutFeedId)).toBe(false);
  });

  it('should return false for missing keyGeneration', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyGeneration, ...withoutKeyGen } = validContext;
    expect(isGroupMessageDecryptionContext(withoutKeyGen)).toBe(false);
  });

  it('should return false for missing encryptedContent', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedContent, ...withoutContent } = validContext;
    expect(isGroupMessageDecryptionContext(withoutContent)).toBe(false);
  });

  it('should return false for wrong field types', () => {
    expect(isGroupMessageDecryptionContext({ ...validContext, feedId: 123 })).toBe(false);
    expect(isGroupMessageDecryptionContext({ ...validContext, keyGeneration: '0' })).toBe(false);
    expect(isGroupMessageDecryptionContext({ ...validContext, encryptedContent: null })).toBe(
      false
    );
  });

  it('should return false for null', () => {
    expect(isGroupMessageDecryptionContext(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGroupMessageDecryptionContext(undefined)).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isGroupMessageDecryptionContext('string')).toBe(false);
    expect(isGroupMessageDecryptionContext(123)).toBe(false);
    expect(isGroupMessageDecryptionContext([])).toBe(false);
  });
});
