# How to Test the Smartwill Application

1. Install [MetaMask](https://metamask.io/) if you haven't already.

2. Connect to the **Arbitrum Sepolia** test network in MetaMask using one of two methods:

   ### 🧩 Option 1: Via Chainlist
    - Visit: https://chainlist.org/chain/421614
   - Click **“Connect Wallet”**, authorize MetaMask, then click **“Add to MetaMask”** for Arbitrum Sepolia :contentReference[oaicite:1]{index=1}.
   - In the MetaMask popup, click **“Approve”**, then **“Switch network”**.

   ### ✍️ Option 2: Add Manually
    - Open MetaMask → click the network dropdown → choose **Settings** → **Networks** → **Add Network** → **Add a network manually** :contentReference[oaicite:2]{index=2}.
   - Enter the following details:
        - **Network Name**: Arbitrum Sepolia
        - **RPC URL**: `https://sepolia-rollup.arbitrum.io/rpc` :contentReference[oaicite:3]{index=3}
        - **Chain ID**: `421614` :contentReference[oaicite:4]{index=4}
        - **Currency Symbol**: ETH
          - **Block Explorer URL**: `https://sepolia.arbiscan.io/` :contentReference[oaicite:5]{index=5}
   - Click **“Save”**, then **“Switch to this network”** in the popup.

3. Get test ETH for Arbitrum Sepolia via the [Alchemy Arbitrum Sepolia Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia).  
   🚨 *Note:* To receive faucet funds, your wallet must hold at least 0.01 ETH on Arbitrum mainnet — this is anti-bot protection.

4. Start testing:
    - Open the app at:  
      `https://skrylkovs.github.io/smartwill-ui/`
    - In MetaMask, ensure **Arbitrum Sepolia** is selected.
    - Test core flows:
        - Connect wallet
        - Interact with the smart contract
        - Send transactions
    - Monitor transactions via [Arbiscan Sepolia Explorer](https://sepolia.arbiscan.io/)

---

If you have any questions, feel free to ask!