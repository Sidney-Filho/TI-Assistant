import os
from langchain.chains import ConversationalRetrievalChain
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_openai import OpenAIEmbeddings
from supabase.client import Client, create_client
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from langchain.memory import ConversationBufferMemory

load_dotenv()

# Initialize components once at startup
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)
openai_api_key = os.getenv("OPENAI_API_KEY")

# Initialize embeddings and vector store once
embeddings = OpenAIEmbeddings()
vector_store = SupabaseVectorStore(
    client=supabase,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents",
)

# Initialize LLM once
llm = ChatOpenAI(
    model_name="gpt-o3",
    temperature=0,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str
    chat_history: list = []

# Global conversation chain with memory
memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True,
    output_key='answer'
)

chain = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=vector_store.as_retriever(search_kwargs={"k": 3}),
    memory=memory,
    return_source_documents=True,
    output_key='answer'
)

@app.post("/ask")
async def ask_question(request: QuestionRequest):
    try:
        # Clear previous memory and set the chat history
        memory.clear()
        for message in request.chat_history:
            if isinstance(message, str):
                memory.chat_memory.add_user_message(message)
        
        response = chain({"question": request.question})
        
        # Process response
        answer = response["answer"]
        source_documents = response["source_documents"]
        
        sources = []
        for doc in source_documents:
            sources.append({
                "content": doc.page_content[:100] + "...",
                "source": doc.metadata.get("source", "Unknown")
            })
        
        return {
            "answer": answer,
            "sources": sources,
            "chat_history": [msg.content for msg in memory.chat_memory.messages]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))