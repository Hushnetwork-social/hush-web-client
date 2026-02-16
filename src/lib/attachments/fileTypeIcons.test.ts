import { describe, it, expect } from 'vitest';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Archive,
  Video,
  File,
} from 'lucide-react';
import { getFileTypeIcon, formatFileSize } from './fileTypeIcons';

describe('FEAT-068: fileTypeIcons', () => {
  describe('getFileTypeIcon', () => {
    it('should return red FileText for PDF', () => {
      const result = getFileTypeIcon('report.pdf');
      expect(result.icon).toBe(FileText);
      expect(result.colorClass).toBe('text-red-400');
      expect(result.label).toBe('PDF Document');
    });

    it('should return blue FileText for Word docs', () => {
      expect(getFileTypeIcon('file.doc').icon).toBe(FileText);
      expect(getFileTypeIcon('file.doc').colorClass).toBe('text-blue-400');
      expect(getFileTypeIcon('file.docx').colorClass).toBe('text-blue-400');
    });

    it('should return green FileSpreadsheet for Excel', () => {
      expect(getFileTypeIcon('file.xls').icon).toBe(FileSpreadsheet);
      expect(getFileTypeIcon('file.xls').colorClass).toBe('text-green-400');
      expect(getFileTypeIcon('file.xlsx').icon).toBe(FileSpreadsheet);
    });

    it('should return orange FileText for PowerPoint', () => {
      expect(getFileTypeIcon('file.ppt').icon).toBe(FileText);
      expect(getFileTypeIcon('file.ppt').colorClass).toBe('text-orange-400');
      expect(getFileTypeIcon('file.pptx').colorClass).toBe('text-orange-400');
    });

    it('should return gray FileText for text files', () => {
      expect(getFileTypeIcon('notes.txt').icon).toBe(FileText);
      expect(getFileTypeIcon('notes.txt').colorClass).toBe('text-gray-400');
    });

    it('should return yellow Archive for archives', () => {
      expect(getFileTypeIcon('files.zip').icon).toBe(Archive);
      expect(getFileTypeIcon('files.zip').colorClass).toBe('text-yellow-400');
      expect(getFileTypeIcon('files.rar').icon).toBe(Archive);
      expect(getFileTypeIcon('files.7z').icon).toBe(Archive);
    });

    it('should return gray FileCode for code files', () => {
      for (const ext of ['js', 'ts', 'py', 'json', 'xml', 'html', 'css']) {
        const result = getFileTypeIcon(`file.${ext}`);
        expect(result.icon).toBe(FileCode);
        expect(result.colorClass).toBe('text-gray-400');
      }
    });

    it('should return purple Video for video files', () => {
      for (const ext of ['mp4', 'mov', 'webm', 'avi']) {
        const result = getFileTypeIcon(`video.${ext}`);
        expect(result.icon).toBe(Video);
        expect(result.colorClass).toBe('text-purple-400');
      }
    });

    it('should return generic File for unknown extensions', () => {
      const result = getFileTypeIcon('unknown.xyz');
      expect(result.icon).toBe(File);
      expect(result.colorClass).toBe('text-gray-500');
      expect(result.label).toBe('File');
    });

    it('should return generic File for files without extension', () => {
      expect(getFileTypeIcon('noextension').icon).toBe(File);
    });

    it('should be case-insensitive', () => {
      expect(getFileTypeIcon('FILE.PDF').icon).toBe(FileText);
      expect(getFileTypeIcon('VIDEO.MP4').icon).toBe(Video);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(512 * 1024)).toBe('512.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
      expect(formatFileSize(25 * 1024 * 1024)).toBe('25.0 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });
  });
});
