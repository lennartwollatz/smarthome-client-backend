export interface EventCondition {
    id: number;
    name:string;
    type: "str" | "num" | "bool" | "int" | "dbl" | "obj";
    value: string | number | boolean | object | null;
}