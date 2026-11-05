import { createContext, useContext } from 'react';

// A number that goes up each time anyone in the college changes something. 0 until the first change is seen.
export const LiveCtx = createContext(0);
export const useLive = () => useContext(LiveCtx);
