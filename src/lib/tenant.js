import { collection, doc } from 'firebase/firestore';
import { db } from './firebase';

// Every college-owned path is built here from the signed-in user's own institutionId.
export const tcol = (iid, ...segments) => collection(db, 'institutions', iid, ...segments);
export const tdoc = (iid, ...segments) => doc(db, 'institutions', iid, ...segments);

export const ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  COLLEGE_ADMIN: 'COLLEGE_ADMIN',
  FACULTY: 'FACULTY',
  STUDENT: 'STUDENT',
  LIBRARIAN: 'LIBRARIAN',
  PARENT: 'PARENT',
};

// A student, or a parent looking at that student's own records (the user has the same studentId field either way).
export const isWardRole = (role) => role === ROLES.STUDENT || role === ROLES.PARENT;

export const isAdminRole = (role) => role === ROLES.SUPER_ADMIN || role === ROLES.COLLEGE_ADMIN;
