/**
 * Domain types for SmartWill contracts.
 *
 * Naming convention:
 *   - WillInfo          — summary view shown in the owner's will list (MyWills)
 *   - HeirWillInfo      — summary view shown in the heir's will list  (HeirWills)
 *   - WillDetailBase    — shared detailed view with bigint fields
 *   - WillOwnerView     — owner dashboard detail (extends WillDetailBase)
 *   - WillHeirView      — heir  dashboard detail (extends WillDetailBase + canTransferNow)
 */

/** Compact will info for the owner's list (all values pre-formatted as strings). */
export interface WillInfo {
    address: string;
    balance: string;
    heir: string;
    heirName: string;
    heirRole: string;
    transferAmount: string;
    transferFrequency: string;
    waitingPeriod: string;
    limit: string;
}

/** Compact will info for the heir's list (all values pre-formatted as strings). */
export interface HeirWillInfo {
    address: string;
    balance: string;
    ownerAddress: string;
    heirName: string;
    heirRole: string;
    transferAmount: string;
    transferFrequency: string;
    waitingPeriod: string;
    ownerLastActivity: string;
    limit: string;
    canClaim: boolean;
    nextClaimTime: string;
}

/** Shared base for detailed dashboard views (raw bigint values from contract). */
export interface WillDetailBase {
    owner: string;
    heir: string;
    heirName: string;
    heirRole: string;
    transferAmount: bigint;
    balance: bigint;
    isOwnerActive: boolean;
    lastActivity: bigint;
    willActivateWaitingPeriod: bigint;
    transferFrequency: bigint;
    nextPossibleTransferTime: bigint;
}

/** Owner dashboard detail — same as base (kept as a distinct alias for clarity). */
export type WillOwnerView = WillDetailBase;

/** Heir dashboard detail — base + transfer-readiness flag. */
export interface WillHeirView extends WillDetailBase {
    canTransferNow: boolean;
}
