export interface EventParameter {
    id: number;
    name:string;
    type: "str" | "num" | "bool" | "int" | "dbl" | "str[]" | "int[]" | "bool[]" | "dbl[]";
    fromFunction?: string;
    value: string | number | boolean | string[] | number[] | boolean[];
}