import { handleChat } from '../controllers/chatbotController.js';

export const initChatbotSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('Client kết nối chatbot:', socket.id);

        socket.on('chatbot:message', async (msg) => {
            console.log('Tin nhắn chatbot:', msg);

            try {
                const reply = await handleChat(msg); // gọi OpenAI + MongoDB xử lý
                socket.emit('chatbot:reply', reply);
            } catch (error) {
                console.error('Lỗi xử lý chatbot:', error.message);
                socket.emit('chatbot:reply', 'Xin lỗi, tôi đang gặp sự cố.');
            }
        });

        socket.on('disconnect', () => {
            console.log('Client rời chatbot:', socket.id);
        });
    });
};
