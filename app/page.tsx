import Image from "next/image";
import Sider from "@/components/Sider";
import { Input, Icon } from 'antd';
import React from 'react'
import { chatCompletion } from '@/api/index';

export default class Home extends React.Component {
  sendChatMessage(){
    console.log('sendChatMessage')
    chatCompletion({}).then(res => {
      console.log(res)
    })
  }
  render() {
    return (
      <main className="flex min-h-screen flex-col items-center justify-between">
        <Sider></Sider>
        <div className="flex flex-col w-full h-full">
          <main className="flex-1 overflow-hidden">
          </main>
          <footer className="footerClass bg-current">
            <div className="w-full max-w-screen-xl m-auto">
              <Input size="large" placeholder="请输入你的问题" />
              <Icon type="right-square" onClick={this.sendChatMessage.bind(this)} theme="twoTone" />
            </div>
          </footer>
        </div>
      </main>
    );
  }
}
