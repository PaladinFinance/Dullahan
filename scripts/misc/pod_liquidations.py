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

MANAGER_ADDRESS = "0xD8B9147B8f77721635b1C4128c25dA601F10edc4"

with open(os.path.dirname(os.path.realpath(__file__)) + "/../../abi/PodManager.json") as f:
    Manager_ABI = json.load(f)

manager = w3.eth.contract(abi=Manager_ABI, address=MANAGER_ADDRESS)

pod_list = manager.functions.getPodList().call()

for i in range(0, len(pod_list)):
    is_liquidable = manager.functions.isPodLiquidable(pod_list[i]).call()

    if is_liquidable:
        print("Pod " + str(i) + " is liquidable")
        """tx_dict = manager.functions.liquidatePod(pod_list[i]).buildTransaction({
            'from' : user_acc.address,
            'nonce' : w3.eth.getTransactionCount(user_acc.address),
        })
        tx = w3.eth.account.signTransaction(tx_dict, user_acc.key)
        result = w3.eth.sendRawTransaction(tx.rawTransaction)
        print('Tx hash : ' + str(result.hex()))
        time.sleep(5)
        txReceipt = w3.eth.waitForTransactionReceipt(result)
        print()
        print("Liquidation Result : " + ("Success" if txReceipt.status == 1 else "Failed"))
        print()"""

