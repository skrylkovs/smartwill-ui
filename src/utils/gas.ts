import { ethers } from "ethers";

/**
 * Returns transaction overrides with a buffered maxFeePerGas
 * to avoid "maxFeePerGas less than block base fee" errors on Arbitrum.
 *
 * @param signer - ethers Signer connected to a provider
 * @param bufferPercent - percentage buffer above current maxFeePerGas (default 20%)
 * @returns object suitable for spreading into a contract call as overrides
 */
export async function getGasOverrides(
    signer: ethers.Signer,
    bufferPercent: number = 20
): Promise<{ maxFeePerGas: bigint }> {
    const provider = signer.provider as ethers.BrowserProvider;
    const feeData = await provider.getFeeData();
    const baseFee = feeData.maxFeePerGas ?? 0n;
    const maxFeePerGas = baseFee * BigInt(100 + bufferPercent) / 100n;
    return { maxFeePerGas };
}