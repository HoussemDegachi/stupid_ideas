# POOP OVERLOAD
# This program is stuffed to the brink, parked just under 100% full.
# It still runs... but almost every word comes out with company.
# One more bite (try: pickle = 1) and it becomes a DiarrheaError.

bacon = 1
cheddar = 1
sugar = 1
ketchup = 1

pasta = [
    "Welcome to the all you can eat buffet of regret",
    "The waiter brings a tower of pancakes taller than the building",
    "Somebody orders extra cheese on the extra cheese",
    "The chef shouts that the fryer has achieved sentience",
    "A single brave lettuce leaf hides under the gravy",
    "Dessert is served in a bucket with a shovel",
    "The table starts to make sounds that tables should not make",
    "Your program loosens its belt and asks for the check",
]


def narrate(potato, carrot):
    return f"Course {potato} of {len(pasta)}: {carrot}, and everybody is still chewing"


for egg, rice in enumerate(pasta, start=1):
    print(narrate(egg, rice))

print()
print("Thank you for dining with us. Please do not stand up too quickly.")
