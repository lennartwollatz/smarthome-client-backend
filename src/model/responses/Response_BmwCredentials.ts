/** Status der BMW-Zugangsdaten; das Passwort ist write-only und wird nie zurückgegeben. */
export class Response_BmwCredentials {
  readonly username: string;
  readonly hasPassword: boolean;
  readonly hasCaptchaToken: boolean;
  readonly hasBmwToken: boolean;
  readonly hasValidBmwToken: boolean;
  readonly bmwTokenExpired: boolean;
  readonly canDiscover: boolean;

  constructor(info: Response_BmwCredentials) {
    this.username = info.username;
    this.hasPassword = info.hasPassword;
    this.hasCaptchaToken = info.hasCaptchaToken;
    this.hasBmwToken = info.hasBmwToken;
    this.hasValidBmwToken = info.hasValidBmwToken;
    this.bmwTokenExpired = info.bmwTokenExpired;
    this.canDiscover = info.canDiscover;
  }
}
