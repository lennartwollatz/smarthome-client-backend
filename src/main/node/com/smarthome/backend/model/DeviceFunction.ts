/**
 * Parameter für eine Gerätefunktion.
 * 
 * @property typ - Der Typ des Parameters (int, string, bool, double)
 * @property function - Optional: Name der Funktion, von der der Returnwert genommen werden kann
 */
export class FunctionParameter {
  typ?: string; // 'int' | 'string' | 'bool' | 'double'
  function?: string | null; // Name der Funktion, von der der Returnwert genommen werden kann

  constructor(init?: Partial<FunctionParameter>) {
    Object.assign(this, init);
  }

  static fromString(typ: string, func: string | null = null): FunctionParameter {
    return new FunctionParameter({ typ, function: func });
  }
}

/**
 * Definition einer Gerätefunktion.
 * 
 * @property functionname - Der Name der Funktion
 * @property parametertypen - Array von Parametertypen für diese Funktion
 * @property returntyp - Der Rückgabetyp der Funktion (int, string, bool, void, etc.)
 */
export class DeviceFunction {
  functionname?: string;
  parametertypen?: FunctionParameter[];
  returntyp?: string;

  constructor(init?: Partial<DeviceFunction>) {
    Object.assign(this, init);
  }

  /**
   * Erstellt eine DeviceFunction aus einem Funktionsnamen-String.
   * Parst Parameter aus Klammern, z.B. "setBrightness(int)" -> { functionname: "setBrightness(int)", parametertypen: [{typ: "int"}], returntyp: "void" }
   */
  static fromString(funcName: string, returntyp: string = 'void'): DeviceFunction {
    const parametertypen: FunctionParameter[] = [];
    
    // Parse Parameter aus Klammern, z.B. "setBrightness(int)" oder "setColor(double,double)"
    const match = funcName.match(/\(([^)]*)\)/);
    if (match && match[1]) {
      const params = match[1].split(',').map(p => p.trim()).filter(p => p.length > 0);
      for (const param of params) {
        parametertypen.push(FunctionParameter.fromString(param));
      }
    }

    return new DeviceFunction({
      functionname: funcName,
      parametertypen,
      returntyp
    });
  }

  /**
   * Erstellt eine DeviceFunction mit expliziten Parametern.
   */
  static create(
    functionname: string,
    parametertypen: FunctionParameter[],
    returntyp: string = 'void'
  ): DeviceFunction {
    return new DeviceFunction({ functionname, parametertypen, returntyp });
  }
}

/**
 * Konvertiert ein Array von Funktionsnamen-Strings in DeviceFunction-Objekte.
 */
export function stringsToDeviceFunctions(funcNames: string[], defaultReturntyp: string = 'void'): DeviceFunction[] {
  return funcNames.map(name => DeviceFunction.fromString(name, defaultReturntyp));
}

/**
 * Konvertiert ein Array von DeviceFunction-Objekten in Funktionsnamen-Strings.
 */
export function deviceFunctionsToStrings(functions: DeviceFunction[]): string[] {
  return functions.map(f => f.functionname ?? '').filter(name => name.length > 0);
}

