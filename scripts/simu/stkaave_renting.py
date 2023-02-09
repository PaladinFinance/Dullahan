import sys
import os
import time
from matplotlib import pyplot as plt
import numpy as np
from decimal import *

getcontext().prec = 18
getcontext().rounding = ROUND_FLOOR


# ----------- Constants -------------

base_multiplier = Decimal(1)
threshold = Decimal(0.75)

year = Decimal(31536000)

fee = Decimal(0.1) # 10% fee

# ------------------------------------
# ------------------------------------
# ------------- Inputs ---------------

# from Aave
GHO_per_stkAAVE = Decimal(100)
GHO_yearly_APY = Decimal(0.02) # current eqv to 2% APY
max_interest_rate_discount = Decimal(0.20)

# from Dullahan
vault_TVL = Decimal(80_000)
renting_fee_yearly = Decimal(0.1)
renting_fee_per_sec = renting_fee_yearly / year

extra_multiplier_per_bps = Decimal(4) # => so 100% => multiplier is x2

# prices
stkAave_price = Decimal(86.33)
GHO_price = Decimal(1)

# ------------------------------------
# ------------------------------------
# ------------ Outputs ---------------

rented_amounts = []
utilization_rates = []
vanilla_rates = []
discounted_rates = []
yearly_renting_rates = []
total_rates = []
dstkAave_APRs = []

# ------------------------------------
# ------------------------------------
# ---------- Calculations ------------

print("Calculating ...")
print()
print()
print("! Attention !")
print("Calculations where made based on arbitrary values")
print("and renting yearly rate is based on an estimation of the total borrowed GHO")

max_discount_GHO_borrow_APY = GHO_yearly_APY * (Decimal(1) - max_interest_rate_discount)

utilization_steps = Decimal(1_000)
current_utilization = Decimal(0)

while(current_utilization <= vault_TVL):
    utilization_rate = current_utilization / vault_TVL
    current_rate = renting_fee_per_sec
    print(utilization_steps)
    print(utilization_rate)
    print(current_rate)
    print()

    if(utilization_rate >= threshold):
        multiplier = base_multiplier + (extra_multiplier_per_bps * (utilization_rate - threshold))
        print(multiplier)
        current_rate = current_rate * multiplier
        print(current_rate)
        print()

    yearly_rate = current_rate * year
    yearly_renting_rate = yearly_rate / GHO_per_stkAAVE # double check that one
    print(yearly_rate)
    print(yearly_renting_rate)
    print()

    # get total year reward based on rented stkAave amount
    total_GHO_earned = yearly_rate * utilization_steps
    total_GHO_earned_without_fees = total_GHO_earned - (total_GHO_earned * fee)
    GHO_earned_per_deposited_stkAave = total_GHO_earned_without_fees / vault_TVL
    dstkAave_APR = (GHO_earned_per_deposited_stkAave * GHO_price) / stkAave_price
    print(total_GHO_earned)
    print(total_GHO_earned_without_fees)
    print(GHO_earned_per_deposited_stkAave)
    print(dstkAave_APR)
    print()

    #write data in outputs
    rented_amounts.append(current_utilization)
    utilization_rates.append(utilization_rate * Decimal(100))
    yearly_renting_rates.append(yearly_renting_rate * Decimal(100))
    vanilla_rates.append(GHO_yearly_APY * Decimal(100))
    discounted_rates.append(max_discount_GHO_borrow_APY * Decimal(100))
    total_rates.append((yearly_renting_rate + max_discount_GHO_borrow_APY)  * Decimal(100))
    dstkAave_APRs.append(dstkAave_APR * Decimal(100))

    print(f'Rented Amount: {current_utilization}')
    print(f'Utilization: {utilization_rate * Decimal(100)}%')
    print(f'Yearly Renting Rate: {yearly_renting_rate * Decimal(100)}%')
    print(f'Vanilla Borrow Rate: {GHO_yearly_APY * Decimal(100)}%')
    print(f'Discounted Borrow Rate: {max_discount_GHO_borrow_APY * Decimal(100)}%')
    print(f'Adjusted Renting Rate: {(yearly_renting_rate + max_discount_GHO_borrow_APY)  * Decimal(100)}%')
    print(f'Estimated dstkAave APR: {dstkAave_APR * Decimal(100)}%')
    print()

    current_utilization = current_utilization + utilization_steps
    print()
    print('----------')
    print()


# ------------------------------------
# ------------------------------------
# ------------- Display --------------

# print the data here
fig, axs = plt.subplots(1, 1, sharex=False, sharey=False)
fig.suptitle('Dullahan Yearly rate Simulation')

# clear subplots
#for ax in axs:
axs.remove()

gridspec = axs.get_subplotspec().get_gridspec()
subfigs = [fig.add_subfigure(gs) for gs in gridspec]


for row, subfig in enumerate(subfigs):
    subfig.suptitle(f'GHO Borrow Interest Discount: {max_interest_rate_discount * Decimal(100)}%')

    axs = subfig.subplots(nrows=1, ncols=3)
    
    axs[0].plot(utilization_rates, yearly_renting_rates, color='violet')
    axs[0].set_title('Yearly Renting Rates', y=1.0, pad=-14)
    axs[0].set_ylim(0, 5)
    
    axs[1].plot(utilization_rates, vanilla_rates, color='red', label="Vanilla Borrow Rate")
    axs[1].plot(utilization_rates, discounted_rates, color='green', label="Discounted Borrow rate")
    axs[1].plot(utilization_rates, total_rates, color='blue', label="Dullahan Borrow rate")
    axs[1].legend(loc=4, prop={'size': 6})
    axs[1].set_title('Yearly GHO Borrorw Rates', y=1.0, pad=-14)
    axs[1].set_ylim(0, 5)
    
    axs[2].plot(utilization_rates, dstkAave_APRs, color='orange')
    axs[2].set_title('dstkAave holders APR', y=1.0, pad=-14)
    axs[2].set_ylim(0, 1)

# set the spacing between subplots
"""plt.subplots_adjust(left=0.1,
                    bottom=0.1,
                    right=0.9,
                    top=0.9,
                    wspace=0.4,
                    hspace=0.4)"""
plt.show()

# ------------------------------------

