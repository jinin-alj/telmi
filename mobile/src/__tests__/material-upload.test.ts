import {
  appendMaterial,
  describeUploadErrors,
  describeUploads,
} from '@/features/teacher/material-upload';

describe('appendMaterial', () => {
  it('uses the file text alone when the box is empty', () => {
    expect(appendMaterial('  \n', 'Slides text')).toBe('Slides text');
  });

  it('adds the file text after a blank line', () => {
    expect(appendMaterial('My notes\n\n', 'Slides text')).toBe('My notes\n\nSlides text');
  });
});

describe('describeUploads', () => {
  it('names the files that were added and asks the teacher to check them', () => {
    expect(
      describeUploads([
        { fileName: 'notes.pdf', read: true, truncated: false },
        { fileName: 'slides.pptx', read: true, truncated: false },
      ]),
    ).toBe(
      "Added the text from notes.pdf, slides.pptx. Check it and delete anything students shouldn't be checked on.",
    );
  });

  it('says when a long file was only partly added', () => {
    expect(describeUploads([{ fileName: 'book.pdf', read: true, truncated: true }])).toContain(
      'book.pdf is very long, so only its first part was added.',
    );
  });

  it('says nothing when no file could be read', () => {
    expect(describeUploads([{ fileName: 'scan.pdf', read: false, error: 'No text' }])).toBeNull();
  });
});

describe('describeUploadErrors', () => {
  it('lists each file that failed with its reason', () => {
    expect(
      describeUploadErrors([
        { fileName: 'notes.pdf', read: true, truncated: false },
        { fileName: 'scan.pdf', read: false, error: 'No text found.' },
        { fileName: 'photo.png', read: false, error: 'Wrong type.' },
      ]),
    ).toBe('scan.pdf: No text found.\nphoto.png: Wrong type.');
  });

  it('is empty when everything worked', () => {
    expect(describeUploadErrors([{ fileName: 'a.txt', read: true, truncated: false }])).toBeNull();
  });
});
