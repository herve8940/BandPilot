#include <jni.h>
#include <node.h>
#include <android/log.h>
#include <unistd.h>
#include <pthread.h>
#include <vector>
#include <string>
#include <cstring>
static void* logThread(void* value) {
 int fd=*static_cast<int*>(value); char buffer[2048]; ssize_t n;
 while((n=read(fd,buffer,sizeof(buffer)-1))>0){buffer[n]=0;__android_log_write(ANDROID_LOG_INFO,"BandPilot",buffer);}
 close(fd);return nullptr;
}
extern "C" JNIEXPORT jint JNICALL Java_be_bandpilot_android_EngineService_startNode(JNIEnv* env,jclass,jobjectArray input){
 static int pipefd[2];if(pipe(pipefd)==0){dup2(pipefd[1],STDOUT_FILENO);dup2(pipefd[1],STDERR_FILENO);close(pipefd[1]);pthread_t thread;pthread_create(&thread,nullptr,logThread,&pipefd[0]);pthread_detach(thread);}
 std::vector<std::string> values;size_t bytes=0;int count=env->GetArrayLength(input);
 for(int i=0;i<count;i++){auto s=static_cast<jstring>(env->GetObjectArrayElement(input,i));const char* c=env->GetStringUTFChars(s,nullptr);values.emplace_back(c);bytes+=values.back().size()+1;env->ReleaseStringUTFChars(s,c);env->DeleteLocalRef(s);}
 std::vector<char> storage(bytes);std::vector<char*> args;size_t pos=0;
 for(const auto& s:values){args.push_back(storage.data()+pos);memcpy(storage.data()+pos,s.c_str(),s.size()+1);pos+=s.size()+1;}
 return node::Start(count,args.data());
}
