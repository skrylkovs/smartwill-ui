# 📋 Testing

To learn how to test the Smartwill app (using the Arbitrum Sepolia network), see the [testing instructions](./TESTING.md).


# SmartWill – The Future of Digital Inheritance

## 1. Introduction

**SmartWill** is an innovative service that enables users to create **digital wills** powered by **smart contracts**.  
Its key feature is that **inheritance is distributed in portions over time**, according to conditions defined by the testator.

Smart contracts guarantee that after the testator’s death, the funds will be **automatically distributed**  
**without third-party intervention**. This helps prevent heirs from mismanaging the funds, ensuring transparency, security, and immutability of the terms.

---

## 2. The Problem SmartWill Solves

### 🔹 Why Traditional Wills Are Outdated

Traditional wills come with **a number of serious challenges**, making the inheritance process **slow, costly, and unreliable**:

- 📌 **Lengthy processing** – probate and legal procedures can take **months or even years**.
- 📌 **Manipulation and fraud** – documents can be **forged or contested**.
- 📌 **High fees** – notaries, courts, and lawyers **charge significant commissions**.
- 📌 **Uncontrolled spending** – heirs often tend to **quickly and irresponsibly spend inherited assets**.

### 🔹 Real-Life Case: Blockchain-Based Inheritance for a Businessman's Family

Imagine a **successful businessman** with a **wife and five children**. He takes care of his family by providing each member with **a monthly allowance** to ensure **a stable and comfortable lifestyle**.  
The businessman carefully manages the distribution of funds, fully aware of the importance of **responsible financial management** for his family.

#### However, he has **serious concerns**:

- 💰 **All funds might go directly to his spouse**, who could **mismanage or overspend**.
- 📉 **A large lump sum might be wasted quickly**, leaving **children without long-term security**.
- 👦 **The eldest child might lose motivation** due to **access to excessive funds**.
- 🛑 **The spouse might be influenced by third parties** or **lack financial experience**, risking **mismanagement**.

### 🎯 The SmartWill Solution

With **a blockchain-based smart will**, the businessman can:

- ✅ **Configure personalized payments** for each family member **according to pre-defined conditions**.
- ✅ **Set exact payment schedules**, such as **monthly distributions**.
- ✅ **Ensure financial control** – funds are **gradually distributed**.
- ✅ **Protect against interference** – **the contract cannot be changed or canceled**.

### 📅 How It Works

Even **after the businessman's death**, **the financial distribution remains exactly as planned**:

- 📅 **Family members continue to receive payments on schedule**.
- 💡 **Heirs cannot access large sums at once**, protecting **family finances**.
- 🛡 **Gradual payouts shield the family from financial risks**.

---

## 3. Key Features We Provide

- **Smart will creation** using smart contracts.
- **Recurring partial payouts** instead of lump-sum transfers.
- **Automated execution** – no cancellation or alteration possible.
- **"I'm Alive" verification button**.
- **Transparency and security** – impossible to forge or contest.
- **No intermediaries** – no notaries, courts, lawyers, or banks.

---

## 4. Business Logic and System Dependencies

### 🔹 How It Works

1. The testator creates a **smart contract** specifying:

-  **Heir’s full name and role (for example, son, daughter, wife, etc.)**
-  **Heir’s wallet – the address to which funds will be sent.**
-  **Transfer amount – how much the heir can receive in one transaction (Transfer: 0.0001 ETH).**
-  **Will balance – the total amount available for the heir (Balance: 0.005 ETH).**
-  **Transfer frequency – how often the heir can receive the specified amount (for example, every 3 minutes).**
-  **Waiting period – the period of the testator’s inactivity after which the heir can start receiving payments (for example, 5 minutes).**

2. The contract is deployed on **Ethereum L2** (Arbitrum, Optimism, Base).
3. The testator **confirms the life status** using the **Confirm Life Activity** button.
4. **If the testator is inactive**, the contract activates the payment option automatically.
5. **The heir enters the heir interface. He sees all the wills that are issued to him**
5. **The heir regularly receives payments by clicking the "Receive funds" button**
6. **The heir can receive funds until the contract balance is exhausted.**
7. **If the heir has not received a payment for several periods, then by clicking "Receive funds" he will receive money for several periods at once.**

### 🔹 Dependencies

- **Ethereum L2** (Arbitrum, Optimism, Base)
- **Web3 libraries** (`ethers.js`, `web3.js`)
- **React + Chakra UI** (Web interface)
- **Hardhat** (Contract testing and deployment)

---

## 5. Use Cases and Application Areas

### 🎯 What Problem Does SmartWill Solve?

- 📌 **Traditional wills are slow, risky, and expensive**.
- 📌 **Inheritance can be misused or wasted**.
- 📌 **Legal processes involve high costs and delays**.

**SmartWill offers:**

- ✅ **Automated inheritance distribution**.
- ✅ **Scheduled payouts to prevent overspending**.
- ✅ **Transparent and secure execution**.

### 🔥 Example Use Cases

- **Businessmen** ensuring controlled family payouts.
- **Investors** securing crypto assets for heirs.
- **Charitable foundations** managing recurring donations.

---

## 6. Potential Risks and Limitations

### ❌ Showstoppers

- **On-chain contract cannot be stopped once deployed**.
- **Legal recognition may vary by jurisdiction**.

### 🚧 Limitations

- **Irreversible once deployed** – fixed contract conditions.
- **Heirs need crypto wallets and basic crypto knowledge**.

---

## 7. Source Code and Security

- 📌 **Open-source contract code available**.
- 📌 **Published on IPFS or GitHub**.
- 📌 **Secured by blockchain’s decentralized nature**.

---

## 8. Our Community

- 💬 **GitHub**: https://github.com/skrylkovs/smartwill/tree/develop

---

## 9. Glossary

- **Blockchain** – decentralized cryptographic ledger.
- **Blockchain wallet** – digital asset management tool.
- **Ethereum** – leading smart contract platform.
- **Layer 2 (L2)** – Ethereum scaling technology.
- **Smart contract** – self-executing blockchain program.
- **Web3** – decentralized internet framework.
- **React** – UI development library.
- **Hardhat** – smart contract development tool.
- **Web interface** – client-side blockchain interaction layer.

---

## 10. Technical Implementation

### 🔹 Technology Stack

- **Blockchain**: Ethereum L2 (Arbitrum, Optimism, Base)
- **Frontend**: React, Vite, Chakra UI
- **Backend**: Solidity, Hardhat, Ethers.js

### 🔹 System Modules

1. **SmartWill Smart Contract**
2. **Web Interface**
3. **Data Storage (IPFS/GitHub)**

### 🔹 Workflow

1. **Contract creation** via web interface.
2. **Deployment and replenishment** of the contract in the blockchain.
3. **Periodic confirmations of "Confirm Life Activity"**.
4. **Automatic payments after the testator's inactivity**.
5. **Regular receipt of funds by the testator in the testator's interface**.
6. **Payments become unavailable when the balance is exhausted**.

---

# 🚀 SmartWill – The Future of Digital Inheritance!