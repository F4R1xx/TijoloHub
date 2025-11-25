const storageManager = {
    KEYS: {
        TRANSACTIONS: 'tijoloHubTransactions',
        FIRE_GOAL: 'tijoloHubFireGoal',
        TARGETS: 'tijoloHubTargets',
        DIVIDENDS: 'tijoloHubDividends' // Nova chave
    },

    saveTransactions(transactions) {
        try {
            const data = JSON.stringify(transactions);
            localStorage.setItem(this.KEYS.TRANSACTIONS, data);
        } catch (error) {
            console.error("Erro ao salvar transações:", error);
            alert("Erro: Armazenamento cheio.");
        }
    },

    loadTransactions() {
        try {
            const data = localStorage.getItem(this.KEYS.TRANSACTIONS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    },

    saveFireGoal(goal) {
        localStorage.setItem(this.KEYS.FIRE_GOAL, goal.toString());
    },

    loadFireGoal() {
        const data = localStorage.getItem(this.KEYS.FIRE_GOAL);
        return data ? parseFloat(data) : 5000;
    },

    saveTargets(targets) {
        localStorage.setItem(this.KEYS.TARGETS, JSON.stringify(targets));
    },

    loadTargets() {
        const data = localStorage.getItem(this.KEYS.TARGETS);
        return data ? JSON.parse(data) : {};
    },

    // --- NOVOS MÉTODOS PARA PROVENTOS ---
    saveDividends(dividends) {
        localStorage.setItem(this.KEYS.DIVIDENDS, JSON.stringify(dividends));
    },

    loadDividends() {
        const data = localStorage.getItem(this.KEYS.DIVIDENDS);
        return data ? JSON.parse(data) : {};
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.TRANSACTIONS);
        localStorage.removeItem(this.KEYS.FIRE_GOAL);
        localStorage.removeItem(this.KEYS.TARGETS);
        localStorage.removeItem(this.KEYS.DIVIDENDS);
        console.log("Limpeza completa.");
    }
};

window.storageManager = storageManager;