// Walidacja hasła: min. 8 znaków, 1 duża litera, 1 cyfra, 1 znak specjalny
const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    return passwordRegex.test(password);
};

module.exports = {validatePassword};