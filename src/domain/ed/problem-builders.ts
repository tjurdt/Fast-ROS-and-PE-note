import type { EdProblem, IcdChoice } from "./types";

type ProblemInput = Omit<
  EdProblem,
  "characterize" | "askMore" | "must" | "peMore" | "peMust" | "icd"
> & {
  characterize?: string[];
  askMore?: string[];
  must?: string[];
  peMore?: string[];
  peMust?: string[];
  icd: IcdChoice[];
};

export function problem(input: ProblemInput): EdProblem {
  return {
    characterize: [],
    askMore: [],
    must: [],
    peMore: [],
    peMust: [],
    ...input,
  };
}

export const on = (code: string, desc: string): IcdChoice => ({
  code,
  desc,
  defaultOn: true,
});
export const off = (code: string, desc: string): IcdChoice => ({ code, desc });
export const whenPick = (
  code: string,
  desc: string,
  item: string,
  option: string,
): IcdChoice => ({ code, desc, whenPick: { item, option } });
