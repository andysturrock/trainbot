FROM eclipse-temurin:21-jre

COPY zscaler2048_sha256.crt /usr/local/share/ca-certificates/zscaler.crt
RUN update-ca-certificates

RUN apt-get update && \
    apt-get install -y apt-transport-https ca-certificates gnupg curl && \
    echo "deb https://packages.cloud.google.com/apt cloud-sdk main" | tee /etc/apt/sources.list.d/google-cloud-sdk.list && \
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /etc/apt/trusted.gpg.d/google-cloud-sdk.gpg add - && \
    apt-get update && \
    apt-get install -y google-cloud-sdk google-cloud-cli-firestore-emulator

ENV PATH $PATH:/usr/lib/google-cloud-sdk/bin
