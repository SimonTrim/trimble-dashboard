/**
 * Vérification licence développeur (email Trimble Connect autorisé).
 */
export type LicenseGateResult = {
    ok: true;
} | {
    ok: false;
    error: string;
};
export declare function verifyLicenseAccess(accessToken: string, isEmbedded: boolean): Promise<LicenseGateResult>;
//# sourceMappingURL=licenseGate.d.ts.map