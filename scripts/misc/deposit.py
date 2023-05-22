import sys
import os
import time
import json
from dotenv import load_dotenv, find_dotenv
from web3 import Web3, HTTPProvider

load_dotenv(find_dotenv('.env'))

""" ======> currently override
MAINNET_URI = os.environ.get('MAINNET_URI')
PRIVATE_KEY = os.environ.get('MAINNET_PRIVATE_KEY')
"""
NETWORK_URI = os.environ.get('GOERLI_URI')
PRIVATE_KEY = os.environ.get('GOERLI_PRIVATE_KEY')


w3 = Web3(HTTPProvider(NETWORK_URI,request_kwargs={'timeout':60}))
user_acc = w3.eth.account.from_key(PRIVATE_KEY)

VAULT_ADDRESS = "0x6c4a5Ae899E86BD2f849b3f53261278e66Ff688C"
STKAAVE_ADDRESS = "0xb85B34C58129a9a7d54149e86934ed3922b05592"

with open(os.path.dirname(os.path.realpath(__file__)) + "/../../abi/Vault.json") as f:
    Vault_ABI = json.load(f)

with open(os.path.dirname(os.path.realpath(__file__)) + "/../../abi/IERC20.json") as f:
    IERC20_ABI = json.load(f)

Vault = w3.eth.contract(abi=Vault_ABI, address=VAULT_ADDRESS)
stkAAVE = w3.eth.contract(abi=IERC20_ABI, address=STKAAVE_ADDRESS)

deposit_amount = w3.to_wei(150, 'ether')

tx_dict = stkAAVE.functions.approve(VAULT_ADDRESS, deposit_amount).build_transaction({
    'from' : user_acc.address,
    'nonce' : w3.eth.get_transaction_count(user_acc.address),
})
tx = w3.eth.account.sign_transaction(tx_dict, user_acc.key)
result = w3.eth.send_raw_transaction(tx.rawTransaction)
print('Tx hash : ' + str(result.hex()))
time.sleep(5)
tx_receipt = w3.eth.wait_for_transaction_receipt(result)
print("Result : " + ("Success" if tx_receipt.status == 1 else "Failed"))
print()

time.sleep(15)

tx_dict = Vault.functions.deposit(deposit_amount, user_acc.address).build_transaction({
    'from' : user_acc.address,
    'nonce' : w3.eth.get_transaction_count(user_acc.address),
})
tx = w3.eth.account.sign_transaction(tx_dict, user_acc.key)
result = w3.eth.send_raw_transaction(tx.rawTransaction)
print('Tx hash : ' + str(result.hex()))
time.sleep(5)
tx_receipt = w3.eth.wait_for_transaction_receipt(result)
print("Result : " + ("Success" if tx_receipt.status == 1 else "Failed"))
print()