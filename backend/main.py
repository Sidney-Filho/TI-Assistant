import os
import openai
import pypdf
from dotenv import load_dotenv
from supabase import create_client
from langchain.embeddings import OpenAIEmbeddings

# 🔐 Carregar variáveis de ambiente
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# 🛠 Configuração do Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 🧠 Configuração do LangChain Embeddings
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

# 📂 Caminho do PDF
pdf_path = "./backend/dados.pdf"

# 📜 Função para extrair texto do PDF
def extrair_texto_pdf(pdf_path):
    with open(pdf_path, "rb") as file:
        leitor = pypdf.PdfReader(file)
        texto = " ".join([page.extract_text() for page in leitor.pages if page.extract_text()])
    return texto

# 🔄 Processar texto extraído e estruturar os dados
def processar_texto(texto):
    blocos = texto.split("\n\n")  # Separar por blocos de texto
    dados = []
    
    marca = modelo = None
    for bloco in blocos:
        if "HP LaserJet Pro" in bloco:
            marca, modelo = "HP", "LaserJet Pro M404"
        elif "Epson EcoTank" in bloco:
            marca, modelo = "Epson", "EcoTank L3150"
        elif "Canon PIXMA" in bloco:
            marca, modelo = "Canon", "PIXMA G3111"

        if "Peça necessária:" in bloco:
            partes = bloco.split("\n")
            problema = partes[0].strip()
            peca = partes[1].replace("Peça necessária: ", "").strip()
            causa = partes[2].replace("Causa provável: ", "").strip()
            procedimento = " ".join(partes[3:]).replace("Procedimento de troca: ", "").strip()
            
            dados.append((marca, modelo, problema, peca, causa, procedimento))
    
    return dados

# ⚡ Inserir no Supabase
def inserir_no_supabase(dados):
    for marca, modelo, problema, peca, causa, procedimento in dados:
        embedding = embeddings.embed_query(problema)  # Criar vetor
        data = {
            "marca": marca,
            "modelo": modelo,
            "problema": problema,
            "peca_necessaria": peca,
            "causa_provavel": causa,
            "procedimento_troca": procedimento,
            "embedding": embedding
        }
        supabase.table("problemas_impressoras").insert(data).execute()
    
    print("✅ Dados inseridos no Supabase com embeddings!")

# 🚀 Executar tudo
texto_extraido = extrair_texto_pdf(pdf_path)
dados_processados = processar_texto(texto_extraido)
inserir_no_supabase(dados_processados)
