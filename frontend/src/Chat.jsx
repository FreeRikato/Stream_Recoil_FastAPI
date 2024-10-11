import React, { useState, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { messagesState } from './state';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/tokyo-night-dark.css'; // Import the tokyonight theme
import './Chat.css';

function Chat() {
  const [messages, setMessages] = useRecoilState(messagesState);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState(null);
  const messagesEndRef = useRef(null);
  const [isBotTyping, setIsBotTyping] = useState(false);

  // Use a ref to store the current bot message
  const streamingMessageRef = useRef('');
  const animationFrameIdRef = useRef(null);

  const [streamingMessage, setStreamingMessage] = useState('');

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws/chat');
    setWs(socket);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.message === '[END]') {
        cancelAnimationFrame(animationFrameIdRef.current);
        // Add the complete bot message to the messages state
        setMessages((prevMessages) => [
          ...prevMessages,
          { sender: 'bot', text: streamingMessageRef.current },
        ]);
        streamingMessageRef.current = '';
        setStreamingMessage('');
        setIsBotTyping(false);
        animationFrameIdRef.current = null;
      } else {
        // Accumulate the tokens
        setIsBotTyping(true);
        streamingMessageRef.current += data.message;

        if (!animationFrameIdRef.current) {
          animationFrameIdRef.current = requestAnimationFrame(() => {
            setStreamingMessage(streamingMessageRef.current);
            animationFrameIdRef.current = null;
          });
        }
      }
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
      socket.close();
    };
  }, [setMessages]);

  useEffect(() => {
    // Scroll to the bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const sendMessage = () => {
    if (ws && input.trim()) {
      ws.send(JSON.stringify({ message: input }));
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: 'user', text: input },
      ]);
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        Real-time Chatbot
      </div>
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.sender}`}>
            <div className="message-content">
              <strong>{msg.sender === 'user' ? 'Human' : 'AI'}:</strong>
              {msg.sender === 'bot' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeHighlight]}
                  className="markdown-content"
                >
                  {msg.text}
                </ReactMarkdown>
              ) : (
                <span>{msg.text}</span>
              )}
            </div>
          </div>
        ))}
        {/* Show the current bot message being streamed */}
        {isBotTyping && streamingMessage && (
          <div className="message bot">
            <div className="message-content">
              <strong>AI:</strong>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                className="markdown-content"
              >
                {streamingMessage}
              </ReactMarkdown>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default Chat;