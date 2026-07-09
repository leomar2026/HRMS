import { Prisma } from "@prisma/client";

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

export function calculateNetSalary(input: {
  basicSalary: Prisma.Decimal.Value;
  housingAllowance: Prisma.Decimal.Value;
  transportAllowance: Prisma.Decimal.Value;
  otherAllowance: Prisma.Decimal.Value;
  overtime?: Prisma.Decimal.Value;
  absenceDeduction?: Prisma.Decimal.Value;
  loanDeduction?: Prisma.Decimal.Value;
}) {
  const basic = decimal(input.basicSalary);
  const housing = decimal(input.housingAllowance);
  const transport = decimal(input.transportAllowance);
  const other = decimal(input.otherAllowance);
  const overtime = decimal(input.overtime ?? 0);
  const absence = decimal(input.absenceDeduction ?? 0);
  const loan = decimal(input.loanDeduction ?? 0);
  const gosiDeduction = decimal(0).toDecimalPlaces(2);
  const netSalary = basic.plus(housing).plus(transport).plus(other).plus(overtime).minus(absence).minus(loan).toDecimalPlaces(2);

  return {
    gosiDeduction,
    netSalary
  };
}
