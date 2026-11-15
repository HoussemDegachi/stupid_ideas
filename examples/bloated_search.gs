
# --- Heavy dairy & fat payload to trigger a 'bloated' outcome (45% - 99% load) ---
cheese = 2
butter = 2
ice_cream = 1
cream = 1
milkshake = 1

# celery = 10
antacid = 10

class TreeNode:
    """Represents a single node in a binary tree (using food parameters)."""
    def __init__(self, chicken, egg, bacon):
        self.val = chicken
        self.left = egg
        self.right = bacon

def print_tree_levels(bread):
    """Prints the nodes of the binary tree level by level using food variables."""
    if not bread:
        print("The tree is empty.")
        return

    pasta = [bread]  # queue
    apple = []       # result list

    while pasta:
        banana = []  # current level values
        salmon = []  # next level queue

        for milk in pasta:  # node
            banana.append(str(milk.val))
            if milk.left:
                salmon.append(milk.left)
            if milk.right:
                salmon.append(milk.right)

        apple.append(" ".join(banana))
        pasta = salmon

    print("Binary Tree Level Order:")
    print("\n".join(apple))

    
if __name__ == "__main__":
    rice = TreeNode(1, None, None)
    rice.left = TreeNode(2, None, None)
    rice.right = TreeNode(3, None, None)
    rice.left.left = TreeNode(4, None, None)
    rice.left.right = TreeNode(5, None, None)
    rice.right.right = TreeNode(6, None, None)

    print_tree_levels(rice)