'use client'
import Image from "next/image";
import Sider from "@/components/Sider";
import { Input } from 'antd';
import { useState } from 'react';
import { chatCompletion } from '@/api/index';
import { RightSquareTwoTone } from '@ant-design/icons';

const Home = () => {
  const [chatList, setChatList] = useState([]);
  const [issue, setIssue] = useState('');

  const onChangeIssue = (e:any) => {
    setIssue(e.target.value);
  };

  const sendChatMessage = () => {
    console.log('sendChatMessage');
    chatCompletion({
      content: issue,
    }).then(res => {
      console.log(res);
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <Sider></Sider>
      <div className="flex flex-col w-full h-full">
        <main className="flex-1 overflow-hidden">
        </main>
        <footer className="footerClass bg-current">
          <div className="w-full max-w-screen-xl m-auto">
            <Input size="large" onInput={onChangeIssue} placeholder="请输入你的问题" />
            <RightSquareTwoTone onClick={sendChatMessage} />
          </div>
        </footer>
      </div>
    </main>
  );
};

export default Home;