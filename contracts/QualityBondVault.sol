// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title QualityBondVault
/// @notice Seller-funded warranties for immediate paid Agent service calls.
/// @dev A verifier may only attest objective SLA breaches. It cannot move more
///      than the service's declared maximum rebate or reuse a request hash.
contract QualityBondVault {
    struct Service {
        address provider;
        bytes32 promiseHash;
        uint128 bondBalance;
        uint128 minimumBond;
        uint128 maximumRebate;
        bool active;
        uint64 withdrawalAvailableAt;
        uint128 pendingWithdrawal;
    }

    bytes32 public constant BREACH_TYPEHASH = keccak256(
        "BreachAttestation(bytes32 serviceId,bytes32 promiseHash,bytes32 requestHash,bytes32 receiptHash,address buyer,uint256 rebateAmount,uint256 deadline,uint256 nonce)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NAME_HASH = keccak256("RelayBond");
    bytes32 private constant VERSION_HASH = keccak256("1");
    uint64 public constant WITHDRAWAL_DELAY = 1 days;

    IERC20 public immutable settlementToken;
    address public immutable verifier;
    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping(bytes32 => Service) public services;
    mapping(bytes32 => bool) public settledRequests;

    event ServiceRegistered(bytes32 indexed serviceId, address indexed provider, bytes32 promiseHash);
    event PromiseUpdated(bytes32 indexed serviceId, bytes32 promiseHash);
    event BondDeposited(bytes32 indexed serviceId, address indexed provider, uint256 amount, uint256 balance);
    event WithdrawalRequested(bytes32 indexed serviceId, uint256 amount, uint256 availableAt);
    event WithdrawalCancelled(bytes32 indexed serviceId);
    event WithdrawalExecuted(bytes32 indexed serviceId, uint256 amount, uint256 balance);
    event ServiceStatusChanged(bytes32 indexed serviceId, bool active);
    event BreachRebated(
        bytes32 indexed serviceId,
        bytes32 indexed requestHash,
        bytes32 indexed receiptHash,
        address provider,
        address buyer,
        uint256 amount,
        uint256 remainingBond
    );

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidSignature();
    error InvalidState();
    error InsufficientBond();
    error TransferFailed();
    error ExpiredAttestation();
    error AlreadySettled();

    constructor(address token_, address verifier_) {
        if (token_ == address(0) || verifier_ == address(0)) revert InvalidConfiguration();
        settlementToken = IERC20(token_);
        verifier = verifier_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this))
        );
    }

    function registerService(
        bytes32 serviceId,
        bytes32 promiseHash,
        uint128 minimumBond,
        uint128 maximumRebate
    ) external {
        if (
            serviceId == bytes32(0) || promiseHash == bytes32(0) ||
            minimumBond == 0 || maximumRebate == 0 || maximumRebate > minimumBond
        ) revert InvalidConfiguration();
        if (services[serviceId].provider != address(0)) revert InvalidState();

        services[serviceId] = Service({
            provider: msg.sender,
            promiseHash: promiseHash,
            bondBalance: 0,
            minimumBond: minimumBond,
            maximumRebate: maximumRebate,
            active: false,
            withdrawalAvailableAt: 0,
            pendingWithdrawal: 0
        });
        emit ServiceRegistered(serviceId, msg.sender, promiseHash);
    }

    function updatePromise(bytes32 serviceId, bytes32 promiseHash) external {
        Service storage service = _ownedService(serviceId);
        if (promiseHash == bytes32(0)) revert InvalidConfiguration();
        service.promiseHash = promiseHash;
        emit PromiseUpdated(serviceId, promiseHash);
    }

    function depositBond(bytes32 serviceId, uint128 amount) external {
        Service storage service = services[serviceId];
        if (service.provider == address(0) || amount == 0) revert InvalidConfiguration();
        if (!settlementToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        service.bondBalance += amount;
        if (service.bondBalance >= service.minimumBond && !service.active) {
            service.active = true;
            emit ServiceStatusChanged(serviceId, true);
        }
        emit BondDeposited(serviceId, service.provider, amount, service.bondBalance);
    }

    function requestWithdrawal(bytes32 serviceId, uint128 amount) external {
        Service storage service = _ownedService(serviceId);
        if (amount == 0 || amount > service.bondBalance) revert InsufficientBond();
        service.pendingWithdrawal = amount;
        service.withdrawalAvailableAt = uint64(block.timestamp) + WITHDRAWAL_DELAY;
        emit WithdrawalRequested(serviceId, amount, service.withdrawalAvailableAt);
    }

    function cancelWithdrawal(bytes32 serviceId) external {
        Service storage service = _ownedService(serviceId);
        service.pendingWithdrawal = 0;
        service.withdrawalAvailableAt = 0;
        emit WithdrawalCancelled(serviceId);
    }

    function executeWithdrawal(bytes32 serviceId) external {
        Service storage service = _ownedService(serviceId);
        uint128 amount = service.pendingWithdrawal;
        if (amount == 0 || block.timestamp < service.withdrawalAvailableAt) revert InvalidState();
        if (amount > service.bondBalance) revert InsufficientBond();

        service.pendingWithdrawal = 0;
        service.withdrawalAvailableAt = 0;
        service.bondBalance -= amount;
        if (service.bondBalance < service.minimumBond && service.active) {
            service.active = false;
            emit ServiceStatusChanged(serviceId, false);
        }
        if (!settlementToken.transfer(service.provider, amount)) revert TransferFailed();
        emit WithdrawalExecuted(serviceId, amount, service.bondBalance);
    }

    function setServiceActive(bytes32 serviceId, bool active) external {
        Service storage service = _ownedService(serviceId);
        if (active && service.bondBalance < service.minimumBond) revert InsufficientBond();
        service.active = active;
        emit ServiceStatusChanged(serviceId, active);
    }

    function claimBreach(
        bytes32 serviceId,
        bytes32 promiseHash,
        bytes32 requestHash,
        bytes32 receiptHash,
        address buyer,
        uint256 rebateAmount,
        uint256 deadline,
        uint256 nonce,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert ExpiredAttestation();
        if (settledRequests[requestHash]) revert AlreadySettled();
        Service storage service = services[serviceId];
        if (!service.active || buyer == address(0)) revert InvalidState();
        if (promiseHash != service.promiseHash) revert InvalidState();
        if (rebateAmount == 0 || rebateAmount > service.maximumRebate) revert InvalidConfiguration();
        if (rebateAmount > service.bondBalance) revert InsufficientBond();

        bytes32 structHash = keccak256(
            abi.encode(
                BREACH_TYPEHASH,
                serviceId,
                promiseHash,
                requestHash,
                receiptHash,
                buyer,
                rebateAmount,
                deadline,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        if (_recover(digest, signature) != verifier) revert InvalidSignature();

        settledRequests[requestHash] = true;
        service.bondBalance -= uint128(rebateAmount);
        if (service.bondBalance < service.minimumBond) {
            service.active = false;
            emit ServiceStatusChanged(serviceId, false);
        }
        if (!settlementToken.transfer(buyer, rebateAmount)) revert TransferFailed();

        emit BreachRebated(
            serviceId,
            requestHash,
            receiptHash,
            service.provider,
            buyer,
            rebateAmount,
            service.bondBalance
        );
    }

    function _ownedService(bytes32 serviceId) private view returns (Service storage service) {
        service = services[serviceId];
        if (service.provider != msg.sender) revert Unauthorized();
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
        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) {
            revert InvalidSignature();
        }
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }
}
