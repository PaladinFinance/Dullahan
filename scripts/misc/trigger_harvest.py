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

with open(os.path.dirname(os.path.realpath(__file__)) + "/../../abi/Vault.json") as f:
    Vault_ABI = json.load(f)

Vault = w3.eth.contract(abi=Vault_ABI, address=VAULT_ADDRESS)

tx_dict = Vault.functions.updateStkAaveRewards().buildTransaction({
    'from' : user_acc.address,
    'nonce' : w3.eth.getTransactionCount(user_acc.address),
})
tx = w3.eth.account.signTransaction(tx_dict, user_acc.key)
result = w3.eth.sendRawTransaction(tx.rawTransaction)
print('Tx hash : ' + str(result.hex()))
time.sleep(5)
txReceipt = w3.eth.waitForTransactionReceipt(result)
print()
print("Result : " + ("Success" if txReceipt.status == 1 else "Failed"))
print()