declare module 'zxcvbn' {
  interface ZXCVBNResult {
    score: number; // 0–4
    feedback: {
      suggestions: string[];
      warning: string;
    };
  }
  export default function zxcvbn(password: string): ZXCVBNResult;
}
