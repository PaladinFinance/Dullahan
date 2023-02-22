import sys
import os
import time
import json
from dotenv import load_dotenv, find_dotenv
from web3 import Web3, HTTPProvider
from decimal import *

getcontext().prec = 18
getcontext().rounding = ROUND_FLOOR

load_dotenv(find_dotenv('.env'))

""" ======> currently override
MAINNET_URI = os.environ.get('MAINNET_URI')
PRIVATE_KEY = os.environ.get('MAINNET_PRIVATE_KEY')
"""
NETWORK_URI = os.environ.get('GOERLI_URI')
PRIVATE_KEY = os.environ.get('GOERLI_PRIVATE_KEY')


w3 = Web3(HTTPProvider(NETWORK_URI,request_kwargs={'timeout':60}))
user_acc = w3.eth.account.from_key(PRIVATE_KEY)

STKAAVE_ADDRESS = "0xb85B34C58129a9a7d54149e86934ed3922b05592"
DEBT_GHO_ADDRESS = "0x80aa933EfF12213022Fd3d17c2c59C066cBb91c7"

MANAGER_ADDRESS = "0xD8B9147B8f77721635b1C4128c25dA601F10edc4"

GHO_DISCOUNTED_PER_DISCOUNT_TOKEN = Decimal(100)
DISCOUNT_THRESHOLD = Decimal(1)

with open(os.path.dirname(os.path.realpath(__file__)) + "/../../abi/PodManager.json") as f:
    Manager_ABI = json.load(f)
with open(os.path.dirname(os.path.realpath(__file__)) + "/../../abi/IERC20.json") as f:
    IERC20_ABI = json.load(f)

# ------------------------------------
# ------------------------------------
# ------------- Inputs ---------------
POD_ADDRESS = ""

# ------------------------------------
# ------------------------------------

stkAAVE = w3.eth.contract(abi=IERC20_ABI, address=STKAAVE_ADDRESS)
debtGHO = w3.eth.contract(abi=IERC20_ABI, address=DEBT_GHO_ADDRESS)
manager = w3.eth.contract(abi=Manager_ABI, address=MANAGER_ADDRESS)

pod_debt_wei = debtGHO.functions.balanceOf(POD_ADDRESS).call()
stkAave_balance_wei = stkAAVE.functions.balanceOf(POD_ADDRESS).call()

pod_debt = Decimal(w3.fromWei(pod_debt_wei, 'ether'))
stkAave_balance = Decimal(w3.fromWei(stkAave_balance_wei, 'ether'))

actual_needed_stkAave = Decimal(0)
if(pod_debt > DISCOUNT_THRESHOLD):
    actual_needed_stkAave = pod_debt / GHO_DISCOUNTED_PER_DISCOUNT_TOKEN
    if(actual_needed_stkAave < DISCOUNT_THRESHOLD): 
        actual_needed_stkAave = 0

if(stkAave_balance > actual_needed_stkAave):
    print("Pod balance : " + str(stkAave_balance))
    print("Needed balance : " + str(actual_needed_stkAave))
    print("Too much stkAAVE in the pod")
    print()
    
    tx_dict = manager.functions.freeStkAave(POD_ADDRESS).buildTransaction({
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



