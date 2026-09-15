// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRecoverySettlementToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice V2 recovery settlement: a failed provider's bond pays an independent
/// backup provider after the verifier binds both delivery receipts to one task.
/// The buyer is not charged a second time.
contract RecoveryBondVaultV2 {
    struct Service {
        address provider;
        uint128 bondBalance;
        uint128 minimumBond;
        uint128 maximumRecovery;
        bool active;
    }

    struct RecoveryAttestation {
        bytes32 primaryServiceId;
        bytes32 backupServiceId;
        bytes32 requestHash;
        bytes32 failedReceiptHash;
        bytes32 recoveredReceiptHash;
        address buyer;
        uint256 recoveryAmount;
        uint256 deadline;
        uint256 nonce;
    }

    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NAME_HASH = keccak256("RelayBond Recovery");
    bytes32 private constant VERSION_HASH = keccak256("2");
    bytes32 private constant RECOVERY_TYPEHASH = keccak256(
        "RecoveryAttestation(bytes32 primaryServiceId,bytes32 backupServiceId,bytes32 requestHash,bytes32 failedReceiptHash,bytes32 recoveredReceiptHash,address buyer,uint256 recoveryAmount,uint256 deadline,uint256 nonce)"
    );

    IRecoverySettlementToken public immutable settlementToken;
    address public immutable verifier;
    bytes32 public immutable DOMAIN_SEPARATOR;
    mapping(bytes32 => Service) public services;
    mapping(bytes32 => bool) public recoveredRequests;

    event ServiceRegistered(bytes32 indexed serviceId, address indexed provider, uint256 minimumBond, uint256 maximumRecovery);
    event BondDeposited(bytes32 indexed serviceId, address indexed provider, uint256 amount, uint256 balance);
    event ServiceStatusChanged(bytes32 indexed serviceId, bool active);
    event BreachRecovered(
        bytes32 indexed primaryServiceId,
        bytes32 indexed backupServiceId,
        bytes32 indexed requestHash,
        bytes32 failedReceiptHash,
        bytes32 recoveredReceiptHash,
        address buyer,
        address backupProvider,
        uint256 amount,
        uint256 remainingPrimaryBond
    );

    error InvalidConfiguration();
    error InvalidState();
    error InvalidSignature();
    error ExpiredAttestation();
    error AlreadyRecovered();
    error InsufficientBond();
    error TransferFailed();

    constructor(address token_, address verifier_) {
        if (token_ == address(0) || verifier_ == address(0)) revert InvalidConfiguration();
        settlementToken = IRecoverySettlementToken(token_);
        verifier = verifier_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this))
        );
    }

    function registerService(bytes32 serviceId, uint128 minimumBond, uint128 maximumRecovery) external {
        if (
            serviceId == bytes32(0) || minimumBond == 0 || maximumRecovery == 0 ||
            maximumRecovery > minimumBond || services[serviceId].provider != address(0)
        ) revert InvalidConfiguration();
        services[serviceId] = Service(msg.sender, 0, minimumBond, maximumRecovery, false);
        emit ServiceRegistered(serviceId, msg.sender, minimumBond, maximumRecovery);
    }

    function depositBond(bytes32 serviceId, uint128 amount) external {
        Service storage service = services[serviceId];
        if (service.provider == address(0) || amount == 0) revert InvalidConfiguration();
        if (!settlementToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        service.bondBalance += amount;
        if (!service.active && service.bondBalance >= service.minimumBond) {
            service.active = true;
            emit ServiceStatusChanged(serviceId, true);
        }
        emit BondDeposited(serviceId, service.provider, amount, service.bondBalance);
    }

    function settleRecovery(RecoveryAttestation calldata claim, bytes calldata signature) external {
        if (block.timestamp > claim.deadline) revert ExpiredAttestation();
        if (recoveredRequests[claim.requestHash]) revert AlreadyRecovered();
        Service storage primary = services[claim.primaryServiceId];
        Service storage backup = services[claim.backupServiceId];
        if (
            !primary.active || !backup.active || primary.provider == backup.provider ||
            claim.buyer == address(0) || claim.failedReceiptHash == bytes32(0) || claim.recoveredReceiptHash == bytes32(0)
        ) revert InvalidState();
        if (claim.recoveryAmount == 0 || claim.recoveryAmount > primary.maximumRecovery) revert InvalidConfiguration();
        if (claim.recoveryAmount > primary.bondBalance) revert InsufficientBond();

        bytes32 structHash = keccak256(
            abi.encode(
                RECOVERY_TYPEHASH,
                claim.primaryServiceId,
                claim.backupServiceId,
                claim.requestHash,
                claim.failedReceiptHash,
                claim.recoveredReceiptHash,
                claim.buyer,
                claim.recoveryAmount,
                claim.deadline,
                claim.nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        if (_recover(digest, signature) != verifier) revert InvalidSignature();

        recoveredRequests[claim.requestHash] = true;
        primary.bondBalance -= uint128(claim.recoveryAmount);
        if (primary.bondBalance < primary.minimumBond) {
            primary.active = false;
            emit ServiceStatusChanged(claim.primaryServiceId, false);
        }
        if (!settlementToken.transfer(backup.provider, claim.recoveryAmount)) revert TransferFailed();
        emit BreachRecovered(
            claim.primaryServiceId,
            claim.backupServiceId,
            claim.requestHash,
            claim.failedReceiptHash,
            claim.recoveredReceiptHash,
            claim.buyer,
            backup.provider,
            claim.recoveryAmount,
            primary.bondBalance
        );
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address signer) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }
}
