export interface EventParameter {
    id: number;
    name:string;
    type: "str" | "num" | "bool" | "int" | "dbl";
    fromFunction?: string;
    value: string | number | boolean;
}