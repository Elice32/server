const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const multer = require('multer');
//const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = 3000;
const mime = require('mime-types');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
      const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, filename);
    }
  });
  
  const upload = multer({ storage: storage });

app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Настройка MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Brat32Chel',
    database: 'user_db'
});
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Brat32Chel',
    database: 'user_db'
});

// Подключение к базе данных
db.connect((err) => {
    if (err) throw err;
    console.log('Подключено к MySQL');
});

// Настройка сессий
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Настройка парсинга
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Добавлено для обработки JSON-запросов

// Настройка статических файлов
app.use(express.static(__dirname));

// Обработка регистрации
app.post('/register', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Хэшируем пароль
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) throw err;

        // Проверка на существование пользователя
        db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
                return res.status(400).send('Пользователь с таким именем уже существует');
            }

            // Сохранение пользователя в базе данных
            db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], (err, results) => {
                if (err) throw err;

                // Получаем ID нового пользователя
                const userId = results.insertId; 
                req.session.username = username;
                req.session.userId = userId; 

                // Перенаправляем на страницу профиля
                res.redirect('/profile');
            });
        });
    });
});

// Обработка входа
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Проверка пользователя
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            return res.status(400).send('Неверное имя пользователя или пароль');
        }

        // Сравниваем пароль с хэшированным паролем
        bcrypt.compare(password, results[0].password, (err, match) => {
            if (err) throw err;
            if (!match) {
                return res.status(400).send('Неверное имя пользователя или пароль');
            }

            req.session.username = username; // Сохранение в сессии
            req.session.userId = results[0].id; // Сохранение userId в сессии
            res.redirect('/profile'); // Перенаправление на страницу профиля
        });
    });
})



// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'site.html')); // Путь к главной странице
});


app.get('/profile', (req, res) => {
    const username = req.session.username || 'Гость';
    const userId = req.session.userId;

    // Убедитесь, что userId существует
    if (!userId) {
        return res.status(401).send('Пользователь не авторизован');
    }

    // Получаем информацию о пользователе
    connection.query('SELECT avatar, status FROM users WHERE id = ?', [userId], (error, userResults) => {
        if (error) {
            console.error('Ошибка при получении информации о пользователе:', error);
            return res.status(500).send('Ошибка сервера');
        }

        const user = userResults[0];
        const userAvatar = user.avatar || 'default-avatar.png'; // Укажите путь к изображению по умолчанию
        const userStatus = user.status || 'Нет статуса';

        // Получаем список друзей для текущего пользователя
        connection.query('SELECT friend_id FROM friends WHERE user_id = ?', [userId], (error, results) => {
            if (error) {
                console.error('Ошибка при получении списка друзей:', error);
                return res.status(500).send('Ошибка сервера');
            }

            //Если у пользователя нет друзей
            if (results.length === 0) {
                return res.send(`
                   <link rel="stylesheet" href="css/profile.css">
                    <body>
                    <h1>Профиль пользователя: ${username}</h1>
                    <p>Ваш ID: ${userId}</p>
                    <h2>Статус:</h2>
                    <p>${userStatus}</p>
                    <h2>Аватар:</h2>
                    <img src="${userAvatar}" alt="Аватар" />
                    <h2>Изменить статус:</h2>
                    <input type="text" id="statusInput" value="${userStatus}" placeholder="Введите новый статус" />
                    <button id="updateStatus">Обновить статус</button>
                    <h2>Изменить аватар:</h2>
                    <input type="text" id="avatarInput" value="${userAvatar}" placeholder="Введите URL аватара" />
                    <button id="updateAvatar">Обновить аватар</button>
                    <h2>Список друзей:</h2>
                    <ul>
                        У вас нет друзей
                    </ul></body>
                    <script>
                        sessionStorage.setItem('userId', '${userId}');

                        // Обработчик для обновления статуса
                        document.getElementById('updateStatus').addEventListener('click', () => {
                            console.log('Кнопка обновления статуса нажата'); // Добавьте это
                            const newStatus = document.getElementById('statusInput').value;
                            const userId = sessionStorage.getItem('userId');

                            fetch('/update-status', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ userId, newStatus })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    alert('Статус обновлен!');
                                } else {
                                    console.error('Ошибка при обновлении статуса:', data.error);
                                }
                            })
                            .catch(error => console.error('Ошибка при обновлении статуса:', error));
                        });


                        // Обработчик для обновления аватара
                        document.getElementById('updateAvatar').addEventListener('click', () => {
                            const newAvatar = document.getElementById('avatarInput').value;
                            const userId = sessionStorage.getItem('userId');

                            fetch('/update-avatar', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ userId, newAvatar })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    alert('Аватар обновлен!');
                                    document.querySelector('img').src = newAvatar; // Обновляем аватар на странице
                                } else {
                                    console.error('Ошибка при обновлении аватара:', data.error);
                                }
                            })
                            .catch(error => console.error('Ошибка при обновлении аватара:', error));
                        });

                        // Добавляем обработчик события для кнопок удаления
                        document.querySelectorAll('.delete-friend').forEach(button => {
                            button.addEventListener('click', () => {
                                const friendId = button.dataset.friendId;
                                const userId = sessionStorage.getItem('userId');

                                fetch('/delete-friend', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ friendId, userId })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        button.parentNode.remove();
                                    } else {
                                        console.error('Ошибка при удалении друга:', data.error);
                                    }
                                })
                                .catch(error => console.error('Ошибка при удалении друга:', error));
                            });
                        });
                    </script>
                `);
            }

            // Получаем имена друзей по их ID
            const friendIds = results.map(row => row.friend_id);
            connection.query('SELECT username, id FROM users WHERE id IN (?)', [friendIds], (error, friendResults) => {
                // Формируем HTML для списка друзей
                let friendsList = friendResults.map(friend => `
                    <li>
                        ${friend.username}
                        <button class="delete-friend" data-friend-id="${friend.id}">Удалить</button>
                    </li>
                `).join('');

                res.send(`
                     <link rel="stylesheet" href="css/profile.css">
                    <body>
                    <h1>Профиль пользователя: ${username}</h1>
                    <p>Ваш ID: ${userId}</p>
                    <h2>Статус:</h2>
                    <p>${userStatus}</p>
                    <h2>Аватар:</h2>
                    <img src="${userAvatar}" alt="Аватар" />
                    <h2>Изменить статус:</h2>
                    <input type="text" id="statusInput" value="${userStatus}" placeholder="Введите новый статус" />
                    <button id="updateStatus">Обновить статус</button>
                    <h2>Изменить аватар:</h2>
                    <input type="text" id="avatarInput" value="${userAvatar}" placeholder="Введите URL аватара" />
                    <button id="updateAvatar">Обновить аватар</button>
                    <h2>Список друзей:</h2>
                    <ul>
                        ${friendsList}
                    </ul>
                    </body>
                    <script>
                        sessionStorage.setItem('userId', '${userId}');

                        // Обработчик для обновления статуса
                        document.getElementById('updateStatus').addEventListener('click', () => {
                            const newStatus = document.getElementById('statusInput').value;
                            const userId = sessionStorage.getItem('userId');

                            fetch('/update-status', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ userId, newStatus })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    alert('Статус обновлен!');
                                } else {
                                    console.error('Ошибка при обновлении статуса:', data.error);
                                }
                            })
                            .catch(error => console.error('Ошибка при обновлении статуса:', error));
                        });

                        // Обработчик для обновления аватара
                        document.getElementById('updateAvatar').addEventListener('click', () => {
                            const newAvatar = document.getElementById('avatarInput').value;
                            const userId = sessionStorage.getItem('userId');

                            fetch('/update-avatar', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ userId, newAvatar })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    alert('Аватар обновлен!');
                                    document.querySelector('img').src = newAvatar; // Обновляем аватар на странице
                                } else {
                                    console.error('Ошибка при обновлении аватара:', data.error);
                                }
                            })
                            .catch(error => console.error('Ошибка при обновлении аватара:', error));
                        });

                        // Добавляем обработчик события для кнопок удаления
                        document.querySelectorAll('.delete-friend').forEach(button => {
                            button.addEventListener('click', () => {
                                const friendId = button.dataset.friendId;
                                const userId = sessionStorage.getItem('userId');

                                fetch('/delete-friend', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ friendId, userId })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        button.parentNode.remove();
                                    } else {
                                        console.error('Ошибка при удалении друга:', data.error);
                                    }
                                })
                                .catch(error => console.error('Ошибка при удалении друга:', error));
                            });
                        });
                    </script>
                `);
            });
        });
    });
});


// Страница входа
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html')); // Путь к странице входа
});

// Страница профиля
// app.get('/profile.html', (req, res) => {
//     res.sendFile(path.join(__dirname, 'profile.html')); // Путь к странице входа
// });




app.post('/update-status', (req, res) => {
    const { userId, newStatus } = req.body;

    connection.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId], (error, results) => {
        if (error) {
            console.error('Ошибка при обновлении статуса:', error);
            return res.status(500).json({ success: false, error: 'Ошибка сервера' });
        }
        res.json({ success: true });
    });
});

app.post('/update-avatar', (req, res) => {
    const { userId, newAvatar } = req.body;

    connection.query('UPDATE users SET avatar = ? WHERE id = ?', [newAvatar, userId], (error, results) => {
        if (error) {
            console.error('Ошибка при обновлении аватара:', error);
            return res.status(500).json({ success: false, error: 'Ошибка сервера' });
        }
        res.json({ success: true });
    });
});





// Обработка получения списка пользователей
app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) throw err;
        res.json(results); // Отправляем список пользователей в формате JSON
    });
});
// Получение списка друзей для пользователя
app.get('/users/:userId/friends', (req, res) => {
    const userId = req.params.userId;

    connection.query('SELECT u.username, f.friend_name FROM friends f JOIN users u ON f.friend_id = u.id WHERE f.user_id = ?', [userId], (error, results) => {
        if (error) return res.status(500).send('Ошибка сервера');
        res.json(results); // Возвращаем список друзей в формате JSON
    });
});
app.post('/delete-friend', (req, res) => {
    const { friendId, userId } = req.body;

    // Удаляем друга из списка друзей
    connection.query('DELETE FROM friends WHERE user_id = ? AND friend_id = ?', [userId, friendId], (error, results) => {
        if (error) {
            console.error('Ошибка при удалении друга:', error);
            return res.status(500).send({ success: false, error: 'Ошибка сервера' });
        }

        res.send({ success: true });
    });
});
// Обработка добавления друга
app.post('/users/:userId/friends', (req, res) => {
    const userId = req.params.userId;
    const { friendId } = req.body;

    // Приводим userId и friendId к строковому типу для корректного сравнения
    if (String(userId) === String(friendId)) {
        return res.status(400).send('Вы не можете добавить себя в друзья.');
    }

    if (!friendId) {
        return res.status(400).send('ID друга не указан');
    }

    // Проверка существования друга
    db.query('SELECT * FROM users WHERE id = ?', [friendId], (err, results) => {
        if (err) {
            console.error('Ошибка при проверке существования друга:', err);
            return res.status(500).send('Ошибка при проверке существования друга');
        }
        if (results.length === 0) {
            return res.status(400).send('Друг с таким ID не найден');
        }

        const friendName = results[0].username; // Получаем имя друга

        // Проверка, добавлен ли друг уже
        db.query('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?', [userId, friendId], (err, results) => {
            if (err) {
                console.error('Ошибка при проверке существования дружбы:', err);
                return res.status(500).send('Ошибка при проверке существования дружбы');
            }
            if (results.length > 0) {
                return res.status(400).send('Друг уже добавлен');
            }

            // Логика для добавления друга в базу данных
            db.query('INSERT INTO friends (user_id, friend_id, friend_name) VALUES (?, ?, ?)', [userId, friendId, friendName], (err, results) => {
                if (err) {
                    console.error('Ошибка при добавлении друга:', err);
                    return res.status(500).send('Ошибка при добавлении друга');
                }
                res.status(200).send('Друг успешно добавлен');
            });
        });
    });
});










//--------------------------------------------Chat-----------------------------------------------
// личный чат
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html')); // Путь к главной странице
});
// Получение сообщений для пользователя
app.get('/chat/:userId', (req, res) => {
    const userId = req.params.userId;
    connection.query(`
      SELECT
        m.text,
        IF(m.sender_id = ?, 'Вы', u_sender.username) AS sender,
        IF(mr.recipient_id = ?, 'Вы', u_recipient.username) AS recipient,
        m.created_at,
        a.filename,
        a.path
      FROM messages m
      JOIN users u_sender ON u_sender.id = m.sender_id
      JOIN message_recipients mr ON mr.message_id = m.id
      LEFT JOIN users u_recipient ON u_recipient.id = mr.recipient_id
      LEFT JOIN attachments a ON a.id = m.attachment_id
      WHERE m.sender_id = ? OR mr.recipient_id = ?
      ORDER BY m.created_at ASC`, [userId, userId, userId, userId], (error, results) => {
      if (error) {
            console.error('Ошибка при получении сообщений:', error);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.json(results);
    });
});
// Отправка сообщения
app.post('/chat/send', upload.single('file'), (req, res) => {
    const { userId, text, recipientId } = req.body;
    const file = req.file;
  
    // Проверяем, что все необходимые данные присутствуют
    if (!userId || !text || !recipientId) {
      return res.status(400).json({ error: 'Недостаточно данных для отправки сообщения' });
    }
  
    // Если файл присутствует, сохраняем его в базе данных и получаем его имя
    let attachmentId = null;
    if (file) {
      const filename = file.filename;
      connection.query('INSERT INTO attachments (filename, path) VALUES (?, ?)', [filename, file.path], (error, results) => {
        if (error) {
          console.error('Ошибка при сохранении вложения:', error);
          return res.status(500).json({ error: 'Ошибка сервера' });
        }
        attachmentId = results.insertId;
        saveMessage(userId, text, recipientId, attachmentId, filename);
      });
    } else {
      saveMessage(userId, text, recipientId);
    }
  
    function saveMessage(userId, text, recipientId, attachmentId, filename) {
      connection.query('INSERT INTO messages (sender_id, text, created_at, attachment_id) VALUES (?, ?, NOW(), ?)', [userId, text, attachmentId], (error, results) => {
        if (error) {
          console.error('Ошибка при сохранении сообщения:', error);
          return res.status(500).json({ error: 'Ошибка сервера' });
        }
        const messageId = results.insertId;
        connection.query('INSERT INTO message_recipients (message_id, recipient_id) VALUES (?, ?)', [messageId, recipientId], (error) => {
          if (error) {
            console.error('Ошибка при сохранении получателя:', error);
            return res.status(500).json({ error: 'Ошибка сервера' });
          }
          res.status(201).json({ success: true, filename });
        });
      });
    }
  });





//---------------------------------------------ОБЩИЙ ЧАТ---------------------------------------
// Create a new chat
app.post('/create-chat', (req, res) => {
    const { chatName, userIds, createdByUsername } = req.body;
    db.query('SELECT id FROM users WHERE username = ?', [createdByUsername], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            // Если пользователь не найден, возвращаем ошибку
            return res.status(404).send('User not found');
        }
        const createdBy = results[0].id;
        db.query('INSERT INTO group_chats (name, created_by) VALUES (?, ?)', [chatName, createdBy], (err, result) => {
            if (err) throw err;
            const chatId = result.insertId;
            userIds.forEach(userId => {
                db.query('INSERT INTO group_chat_members (group_chat_id, user_id) VALUES (?, ?)', [chatId, userId]);
            });
            res.sendStatus(200);
        });
    });
});
// Send a message
app.post('/send-message', (req, res) => {
    const { chatId, message } = req.body;
    db.query('INSERT INTO group_messages (group_chat_id, sender_id, text) VALUES (?, ?, ?)', [chatId, req.userid, message], (err, result) => {
        if (err) throw err;
        res.sendStatus(200);
    });
});

app.get('/group-chats', (req, res) => {
    db.query('SELECT * FROM group_chats', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});
// Get chat messages
app.get('/chat-messages/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    db.query('SELECT * FROM group_messages WHERE group_chat_id = ?', [chatId], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});
















// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});