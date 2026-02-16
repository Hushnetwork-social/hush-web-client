import { describe, it, expect } from 'vitest';
import {
  isBlockedFileType,
  getFileCategory,
  isVideoType,
  isDocumentType,
  isPdfType,
  getBlockedFileMessage,
  FILE_PICKER_ACCEPT_ALL,
} from './fileTypeValidator';

describe('FEAT-068: fileTypeValidator', () => {
  describe('isBlockedFileType', () => {
    it.each([
      'file.exe', 'file.bat', 'file.sh', 'file.msi',
      'file.cmd', 'file.ps1', 'file.vbs', 'file.wsf',
    ])('should block %s', (fileName) => {
      expect(isBlockedFileType(fileName)).toBe(true);
    });

    it.each([
      'file.pdf', 'file.mp4', 'file.docx', 'file.zip',
      'file.js', 'file.png', 'file.txt', 'file.webm',
    ])('should allow %s', (fileName) => {
      expect(isBlockedFileType(fileName)).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isBlockedFileType('FILE.EXE')).toBe(true);
      expect(isBlockedFileType('file.Exe')).toBe(true);
      expect(isBlockedFileType('file.EXE')).toBe(true);
    });

    it('should accept files without extensions', () => {
      expect(isBlockedFileType('noextension')).toBe(false);
    });

    it('should handle files ending with dot', () => {
      expect(isBlockedFileType('file.')).toBe(false);
    });

    it('should use last dot for extension', () => {
      expect(isBlockedFileType('archive.tar.gz')).toBe(false);
      expect(isBlockedFileType('virus.pdf.exe')).toBe(true);
    });
  });

  describe('getFileCategory', () => {
    it.each([
      ['photo.jpg', 'image'],
      ['photo.jpeg', 'image'],
      ['photo.png', 'image'],
      ['photo.gif', 'image'],
      ['photo.webp', 'image'],
      ['photo.heic', 'image'],
      ['photo.svg', 'image'],
    ] as const)('should categorize %s as %s', (fileName, expected) => {
      expect(getFileCategory(fileName)).toBe(expected);
    });

    it.each([
      ['video.mp4', 'video'],
      ['video.mov', 'video'],
      ['video.webm', 'video'],
      ['video.avi', 'video'],
    ] as const)('should categorize %s as %s', (fileName, expected) => {
      expect(getFileCategory(fileName)).toBe(expected);
    });

    it.each([
      ['report.pdf', 'document'],
      ['doc.doc', 'document'],
      ['doc.docx', 'document'],
      ['sheet.xls', 'document'],
      ['sheet.xlsx', 'document'],
      ['slides.ppt', 'document'],
      ['slides.pptx', 'document'],
      ['notes.txt', 'document'],
    ] as const)('should categorize %s as %s', (fileName, expected) => {
      expect(getFileCategory(fileName)).toBe(expected);
    });

    it.each([
      ['files.zip', 'archive'],
      ['files.rar', 'archive'],
      ['files.7z', 'archive'],
    ] as const)('should categorize %s as %s', (fileName, expected) => {
      expect(getFileCategory(fileName)).toBe(expected);
    });

    it.each([
      ['app.js', 'code'],
      ['app.ts', 'code'],
      ['script.py', 'code'],
      ['data.json', 'code'],
      ['config.xml', 'code'],
      ['page.html', 'code'],
      ['style.css', 'code'],
    ] as const)('should categorize %s as %s', (fileName, expected) => {
      expect(getFileCategory(fileName)).toBe(expected);
    });

    it('should return generic for unknown extensions', () => {
      expect(getFileCategory('file.xyz')).toBe('generic');
      expect(getFileCategory('file.abc')).toBe('generic');
    });

    it('should return generic for files without extension', () => {
      expect(getFileCategory('noextension')).toBe('generic');
    });

    it('should be case-insensitive', () => {
      expect(getFileCategory('FILE.PDF')).toBe('document');
      expect(getFileCategory('VIDEO.MP4')).toBe('video');
    });
  });

  describe('isVideoType', () => {
    it('should return true for video MIME types', () => {
      expect(isVideoType('video/mp4')).toBe(true);
      expect(isVideoType('video/webm')).toBe(true);
      expect(isVideoType('video/quicktime')).toBe(true);
    });

    it('should return false for non-video MIME types', () => {
      expect(isVideoType('image/jpeg')).toBe(false);
      expect(isVideoType('application/pdf')).toBe(false);
    });
  });

  describe('isDocumentType', () => {
    it('should return true for document MIME types', () => {
      expect(isDocumentType('application/pdf')).toBe(true);
      expect(isDocumentType('application/msword')).toBe(true);
      expect(isDocumentType('text/plain')).toBe(true);
      expect(isDocumentType('application/zip')).toBe(true);
      expect(isDocumentType('application/json')).toBe(true);
    });

    it('should return false for non-document MIME types', () => {
      expect(isDocumentType('image/jpeg')).toBe(false);
      expect(isDocumentType('video/mp4')).toBe(false);
      expect(isDocumentType('application/octet-stream')).toBe(false);
    });
  });

  describe('isPdfType', () => {
    it('should return true for PDF MIME type', () => {
      expect(isPdfType('application/pdf')).toBe(true);
    });

    it('should return false for non-PDF MIME types', () => {
      expect(isPdfType('application/msword')).toBe(false);
      expect(isPdfType('image/jpeg')).toBe(false);
    });
  });

  describe('getBlockedFileMessage', () => {
    it('should return user-friendly message with extension', () => {
      expect(getBlockedFileMessage('virus.exe')).toBe(
        'Executable files (.exe) are not allowed for security reasons'
      );
    });

    it('should work with different blocked extensions', () => {
      expect(getBlockedFileMessage('script.bat')).toContain('.bat');
      expect(getBlockedFileMessage('installer.msi')).toContain('.msi');
    });
  });

  describe('FILE_PICKER_ACCEPT_ALL', () => {
    it('should include image wildcard', () => {
      expect(FILE_PICKER_ACCEPT_ALL).toContain('image/*');
    });

    it('should include video wildcard', () => {
      expect(FILE_PICKER_ACCEPT_ALL).toContain('video/*');
    });

    it('should include PDF MIME type', () => {
      expect(FILE_PICKER_ACCEPT_ALL).toContain('application/pdf');
    });

    it('should include document MIME types', () => {
      expect(FILE_PICKER_ACCEPT_ALL).toContain('application/msword');
      expect(FILE_PICKER_ACCEPT_ALL).toContain('text/plain');
    });

    it('should include archive MIME types', () => {
      expect(FILE_PICKER_ACCEPT_ALL).toContain('application/zip');
    });
  });
});
