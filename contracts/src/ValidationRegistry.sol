// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ValidationRegistry
/// @notice Issues on-chain evaluation credentials linking a verdict hash,
///         Storacha CID, and ATProto AT-URI to an ERC-8004 agent identity.
contract ValidationRegistry is Ownable {
    struct ValidationCredential {
        uint256 identityAgentId;  // ERC-8004 agentId of the Judge agent
        bytes32 evidenceHash;     // SHA-256 of evidence bundle
        bytes32 verdictHash;      // SHA-256 of judge output JSON
        string  storachaCid;      // Full evaluation archive CID on Storacha
        string  atprotoUri;       // AT-URI of the posted hypercert evaluation record
        uint256 confidenceScore;  // 0–10000 (basis points)
        uint256 issuedAt;
    }

    /// @notice evaluationId => credential
    mapping(bytes32 => ValidationCredential) public credentials;

    /// @notice Addresses authorised to issue credentials
    mapping(address => bool) public operators;

    event ValidationIssued(
        bytes32 indexed evaluationId,
        string  atprotoUri,
        uint256 confidenceScore
    );

    event OperatorUpdated(address indexed operator, bool authorised);

    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not authorised");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        operators[initialOwner] = true;
    }

    function setOperator(address operator, bool authorised) external onlyOwner {
        operators[operator] = authorised;
        emit OperatorUpdated(operator, authorised);
    }

    function issueValidation(
        bytes32 evaluationId,
        uint256 identityAgentId,
        bytes32 evidenceHash,
        bytes32 verdictHash,
        string calldata storachaCid,
        string calldata atprotoUri,
        uint256 confidenceScore
    ) external onlyOperator {
        require(credentials[evaluationId].issuedAt == 0, "Already issued");
        credentials[evaluationId] = ValidationCredential({
            identityAgentId: identityAgentId,
            evidenceHash:    evidenceHash,
            verdictHash:     verdictHash,
            storachaCid:     storachaCid,
            atprotoUri:      atprotoUri,
            confidenceScore: confidenceScore,
            issuedAt:        block.timestamp
        });
        emit ValidationIssued(evaluationId, atprotoUri, confidenceScore);
    }

    function verifyCredential(bytes32 evaluationId, bytes32 verdictHash)
        external
        view
        returns (bool)
    {
        ValidationCredential storage cred = credentials[evaluationId];
        return cred.issuedAt != 0 && cred.verdictHash == verdictHash;
    }

    function getCredential(bytes32 evaluationId)
        external
        view
        returns (ValidationCredential memory)
    {
        return credentials[evaluationId];
    }
}
