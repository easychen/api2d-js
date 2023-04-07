const api2d = require('../cjs/index.js');
// 从环境变量取得key
const forward_key = process.env.FORWARD_KEY||"FK...";
async function doit()
{
    const api2d_instance = new api2d(forward_key);
    const response = await api2d_instance.completion({
        messages: [
            {
                'role':'user',
                'content':'来首唐诗',
            }
        ],
        noCache: true,
        stream: true,
        onMessage: (message) => {
            console.log(message);
        }
    });
    console.log(response);
}

doit();