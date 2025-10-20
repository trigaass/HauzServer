import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

{/*EXEMPLO

   export const sendVerificationEmail = async (email, verificationToken) => {
  try {
    const verificationLink = `https://render-auto.vercel.app/verified/${verificationToken}`;

    await transporter.sendMail({
      from: `"RenderAuto" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Confirme seu e-mail",
      html: `
        <p>Olá,</p>
        <p>Por favor, clique no botão abaixo para verificar seu e-mail:</p>
        <a href="${verificationLink}" style="
            display: inline-block;
            padding: 10px 20px;
            font-size: 16px;
            color: #ffffff;
            background-color: #28a745;
            text-decoration: none;
            border-radius: 5px;
        ">Verificar E-mail</a>
      `,
    });

    console.log(`E-mail de verificação enviado para ${email}`);
  } catch (error) {
    console.error("Erro ao enviar o e-mail de verificação:", error);
    throw error;
  }
}; 
    
*/}