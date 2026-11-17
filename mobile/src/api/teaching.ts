import { apiClient } from '@/api/client';
import type { Classroom, ClassroomDashboard, MaterialText, Unit } from '@/api/types';

/** A file the teacher picked; matches what expo-document-picker returns. */
export type MaterialFile = {
  name: string;
  uri: string;
  mimeType?: string;
  // Only on the web, where the browser hands over the file itself
  file?: File;
};

/** The classes this teacher owns. */
export function listClassrooms(): Promise<Classroom[]> {
  return apiClient.request<Classroom[]>('GET', '/classrooms');
}

/** Create a class and get its join code. */
export function createClassroom(name: string, subject: string): Promise<Classroom> {
  return apiClient.request<Classroom>('POST', '/classrooms', { body: { name, subject } });
}

/** Add a unit with the material students are checked against. */
export function addUnit(classroomId: string, title: string, material: string): Promise<Unit> {
  return apiClient.request<Unit>('POST', `/classrooms/${encodeURIComponent(classroomId)}/units`, {
    body: { title, material },
  });
}

/** Read the text from a teacher's file; nothing is saved until they add the unit. */
export function readMaterialFile(
  classroomId: string,
  materialFile: MaterialFile,
): Promise<MaterialText> {
  const form = new FormData();
  if (materialFile.file !== undefined) {
    form.append('file', materialFile.file);
  } else {
    // React Native uploads a file from its uri; this object shape is how its FormData takes one
    const nativeFile = {
      uri: materialFile.uri,
      name: materialFile.name,
      type: materialFile.mimeType ?? 'application/octet-stream',
    };
    form.append('file', nativeFile as unknown as Blob);
  }
  return apiClient.request<MaterialText>(
    'POST',
    `/classrooms/${encodeURIComponent(classroomId)}/material-text`,
    { body: form },
  );
}

/** How each student and the whole class are doing. */
export function getClassroomDashboard(classroomId: string): Promise<ClassroomDashboard> {
  return apiClient.request<ClassroomDashboard>(
    'GET',
    `/classrooms/${encodeURIComponent(classroomId)}/dashboard`,
  );
}
