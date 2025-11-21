const dataManager = {
    transactions: [],
    targetWeights: {},
    fireGoal: 5000,

    init() {
        this.loadData();
    },

    loadData() {
        const savedTx = localStorage.getItem('tijoloHubTransactions');
        if(savedTx) this.transactions = JSON.parse(savedTx);
        
        const savedGoal = localStorage.getItem('tijoloHubFireGoal');
        if(savedGoal) this.fireGoal = parseFloat(savedGoal);

        const savedTargets = localStorage.getItem('tijoloHubTargets');
        if(savedTargets) this.targetWeights = JSON.parse(savedTargets);
        
        // Garante que a View existe antes de chamar
        if(window.viewRenderer) viewRenderer.updateAll();
    },

    saveData() {
        localStorage.setItem('tijoloHubTransactions', JSON.stringify(this.transactions));
        localStorage.setItem('tijoloHubFireGoal', this.fireGoal);
        localStorage.setItem('tijoloHubTargets', JSON.stringify(this.targetWeights));
        if(window.viewRenderer) viewRenderer.updateAll();
    },

    handleFile(input) {
        if(input.files.length) {
            const file = input.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    // Tenta ler. Se for CSV, o SheetJS geralmente detecta.
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    
                    // Converte para JSON cru para processarmos manualmente os campos
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
                    
                    console.log("Dados Brutos Importados:", jsonData); // Debug no console
                    this.processImport(jsonData);
                } catch (error) {
                    alert("Erro fatal ao ler arquivo: " + error.message);
                    console.error(error);
                }
            };
            reader.readAsArrayBuffer(file);
            input.value = ""; // Reseta input para permitir re-importar o mesmo arquivo
        }
    },

    // Função "Sabujo": Fareja o valor correto ignorando acentos, case e espaços
    findValue(row, possibleKeys) {
        if (!row) return null;
        
        // Cria um mapa das chaves da linha normalizadas
        const normalizedRowKeys = {};
        Object.keys(row).forEach(k => {
            const cleanKey = k.toString().toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
                .replace(/[^a-z0-9]/g, ""); // Remove símbolos e espaços
            normalizedRowKeys[cleanKey] = row[k];
        });

        // Tenta encontrar alguma das chaves possíveis
        for (const key of possibleKeys) {
            const cleanPossible = key.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "");
            
            if (normalizedRowKeys[cleanPossible] !== undefined) {
                return normalizedRowKeys[cleanPossible];
            }
        }
        return null;
    },

    // Converte qualquer formato de número (R$ 1.000,00 ou 1,000.00 ou 1000) para float JS
    parseNumber(value) {
        if (value === undefined || value === null || value === "") return 0;
        if (typeof value === 'number') return value;
        
        let str = value.toString().trim();
        
        // Se tiver símbolo de moeda, remove
        str = str.replace("R$", "").replace("$", "").trim();

        // Detecção de formato BR (1.000,00) vs US (1,000.00)
        // Lógica: Se a última pontuação for vírgula, é decimal BR.
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');

        if (lastComma > lastDot) {
            // Formato BR: Remove pontos de milhar, troca vírgula por ponto
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (lastDot > lastComma) {
            // Formato US: Remove vírgulas de milhar (mantém ponto)
            str = str.replace(/,/g, '');
        }
        
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    },

    processImport(data) {
        const now = new Date();
        const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let newTx = [];
        let errors = 0;

        if (data.length === 0) {
            alert("O arquivo parece estar vazio.");
            return;
        }

        // Loop de processamento
        newTx = data.map((row, index) => {
            // Busca colunas flexíveis
            const ticker = this.findValue(row, ['Ticker', 'Ativo', 'Código', 'Papel', 'Fundo']);
            const qtdRaw = this.findValue(row, ['Quantidade', 'Qtd', 'Quant', 'Cotas']);
            const pmRaw = this.findValue(row, ['Preço Médio', 'Preco Medio', 'PM', 'Preço', 'Preco', 'Valor', 'Custo']);
            const provRaw = this.findValue(row, ['Último Provento', 'Ultimo Provento', 'Proventos', 'Dividendos', 'Div', 'Rendimento']);
            const dataRaw = this.findValue(row, ['Data', 'Date', 'Dia', 'Data Aporte']);
            const setorRaw = this.findValue(row, ['Setor', 'Segmento', 'Tipo']);

            // Se não achar Ticker ou Quantidade, ignora a linha (pode ser linha de total ou lixo)
            if (!ticker || ticker.toString().trim() === '' || !qtdRaw) {
                if (index < 5) console.log("Linha ignorada (dados insuficientes):", row); // Log apenas das primeiras
                return null;
            }

            const qtd = this.parseNumber(qtdRaw);
            const pm = this.parseNumber(pmRaw);
            const prov = this.parseNumber(provRaw);
            
            // Tratamento de Data Robusto
            let date = defaultDate;
            if (dataRaw) {
                if (typeof dataRaw === 'number') {
                    // Data Excel Serial
                    const excelDate = new Date((dataRaw - (25567 + 2)) * 86400 * 1000);
                    date = excelDate.toISOString().substring(0, 7);
                } else {
                    let dStr = dataRaw.toString().trim();
                    // Tenta formatos comuns: DD/MM/YYYY, YYYY-MM-DD
                    if (dStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                        const parts = dStr.split('/'); // [DD, MM, YYYY]
                        date = `${parts[2]}-${parts[1]}`;
                    } else if (dStr.match(/^\d{4}-\d{2}/)) {
                        date = dStr.substring(0, 7);
                    }
                }
            }

            const sector = setorRaw || this.identifySector(ticker);

            return {
                id: crypto.randomUUID(),
                date, 
                ticker: ticker.toString().toUpperCase().trim(),
                qtd, 
                price: pm, 
                dividend: prov,
                sector
            };
        }).filter(t => t !== null && t.qtd > 0); // Remove nulos e qtd zero

        if (newTx.length === 0) {
            // Diagnóstico para o usuário
            const firstRowKeys = Object.keys(data[0]).join(", ");
            alert(`Não consegui ler nenhuma linha válida.\n\nColunas encontradas no seu arquivo:\n${firstRowKeys}\n\nEu preciso de colunas parecidas com: "Ticker", "Quantidade", "Preço Médio".`);
            return;
        }

        this.transactions = [...this.transactions, ...newTx];
        // Ordena por data (mais recente no topo visualmente, mas lógica pede cronológico as vezes)
        this.transactions.sort((a, b) => b.date.localeCompare(a.date));
        
        this.saveData();
        alert(`${newTx.length} registros importados com sucesso!`);
        
        // Força atualização da tela
        if(window.app && window.app.switchTab) window.app.switchTab('dashboard');
    },

    saveAsset(e) {
        e.preventDefault();
        const id = document.getElementById('modal-id').value;
        const tx = {
            id: id || crypto.randomUUID(),
            date: document.getElementById('modal-date').value,
            ticker: document.getElementById('modal-ticker').value.toUpperCase(),
            qtd: parseFloat(document.getElementById('modal-qtd').value),
            price: parseFloat(document.getElementById('modal-pm').value),
            dividend: parseFloat(document.getElementById('modal-div').value),
            sector: document.getElementById('modal-sector').value
        };

        if(id) {
            const idx = this.transactions.findIndex(t => t.id === id);
            if(idx >= 0) this.transactions[idx] = tx;
        } else {
            this.transactions.push(tx);
        }
        
        this.transactions.sort((a, b) => b.date.localeCompare(a.date));
        this.saveData();
        app.closeModal();
        // Se estiver na tela de histórico, recarrega ela
        if(app.currentTab === 'history') viewRenderer.renderHistory();
    },

    deleteTransaction(id) {
        if(confirm('Excluir este aporte do histórico?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveData();
            if(app.currentTab === 'history') viewRenderer.renderHistory();
        }
    },

    resetApp() {
        if(confirm('ATENÇÃO: Isso apagará TODO o seu histórico. Continuar?')) {
            localStorage.clear();
            location.reload();
        }
    },

    exportTable() {
        const portfolio = this.getConsolidatedPortfolio();
        if (portfolio.length === 0) { alert("Nada para exportar."); return; }
        const ws = XLSX.utils.json_to_sheet(portfolio);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Carteira Consolidada");
        XLSX.writeFile(wb, "TijoloHub_Carteira.xlsx");
    },

    getConsolidatedPortfolio() {
        const portfolio = {};
        // Ordena do mais antigo para o mais novo para calcular o Preço Médio corretamente
        // Copia o array para não mudar a ordem visual do histórico
        const sortedTx = [...this.transactions].sort((a, b) => a.date.localeCompare(b.date));
        
        sortedTx.forEach(t => {
            if(!portfolio[t.ticker]) {
                portfolio[t.ticker] = { 
                    ticker: t.ticker, 
                    qtd: 0, 
                    invested: 0, 
                    sector: t.sector, 
                    div: 0 
                };
            }
            
            // Lógica de Acumulação
            portfolio[t.ticker].qtd += t.qtd;
            portfolio[t.ticker].invested += (t.qtd * t.price);
            
            // Atualiza o dividendo com a informação mais recente disponível
            if (t.dividend > 0) portfolio[t.ticker].div = t.dividend;
        });

        return Object.values(portfolio).map(p => {
            const pm = p.qtd > 0 ? p.invested / p.qtd : 0;
            // SIMULAÇÃO: Como não temos API, simulamos que o preço variou um pouco do PM
            // Se quiser remover a simulação, use: const price = pm;
            const variation = (Math.random() * 0.10) - 0.05; // +/- 5%
            const price = pm * (1 + variation);
            
            return {
                ...p,
                pm,
                currentPrice: price,
                totalCurrent: p.qtd * price,
                monthlyIncome: p.qtd * p.div
            };
        });
    },

    identifySector(ticker) {
        const t = ticker.toUpperCase();
        if(t.startsWith('KN') || t.startsWith('CPTS') || t.startsWith('RECR')) return 'Papel';
        if(t.startsWith('HGLG') || t.startsWith('XPLG') || t.startsWith('BTLG')) return 'Logística';
        if(t.startsWith('XPML') || t.startsWith('VISC') || t.startsWith('MALL')) return 'Shopping';
        if(t.startsWith('MXRF') || t.startsWith('VGHF')) return 'Híbrido';
        if(t.startsWith('BCFF') || t.startsWith('KFOF')) return 'Fundo de Fundos';
        if(t.startsWith('KNCA') || t.startsWith('VGIA')) return 'Fiagro';
        return 'Outros';
    },

    formatMoney(val) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val); }
};

// Expor para o escopo global para o HTML conseguir chamar os onlick="dataManager..."
window.dataManager = dataManager;