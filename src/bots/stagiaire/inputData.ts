export type Semester = number | string;

export class InputData {
  private constructor(
    readonly perso: string,
    readonly bonus: number,
    readonly semester: Semester,
    readonly gift: number,
    readonly validated: boolean = true,
    readonly inputBonus: boolean = true
  ) {}

  static async create(
    perso: string,
    bonus: number,
    rawSemester: string,
    gift: number,
    onGiftError: () => Promise<void>,
    onSemesterError: () => Promise<void>
  ) {
    let semester: Semester = parseInt(rawSemester, 10);
    if (isNaN(semester)) semester = rawSemester;
    let validated = true;
    let inputBonus = true;
    if (isNaN(bonus)) {
      if (
        !(await InputData.validateSemester(semester, onSemesterError)) ||
        !(await InputData.validateGift(gift, onGiftError))
      ) {
        validated = false;
      }
      inputBonus = false;
    }
    return new InputData(perso, bonus, semester, gift, validated, inputBonus);
  }

  private static async validateGift(gift: number, onError: () => Promise<void>) {
    switch (gift) {
      case 0:
      case 1:
        return true;
      default:
        await onError();
        return false;
    }
  }

  private static async validateSemester(semester: Semester, onError: () => Promise<void>) {
    switch (semester) {
      case 1:
      case 2:
      case 3:
      case "x":
        return true;
      default:
        await onError();
        return false;
    }
  }
}
